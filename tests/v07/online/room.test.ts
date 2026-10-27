import { describe, expect, it } from 'vitest';
import {
  DECISION_SHOW_CAP_SECONDS,
  DEFAULT_DECISION_SECONDS,
  PROTOCOL_VERSION,
  Room,
  type RoomClock,
  cleanName,
  isRoomCode,
  parseClientMessage,
  type OnlineRequest,
  type ServerMessage,
} from '../../../src/v07/online';

const HOST = 'host-token-0000000001';
const GUEST = 'guest-token-000000002';
const LATE = 'late-token-0000000003';

/** A clock that only moves when a test says so. */
function fakeClock() {
  let now = 0;
  let timers: { readonly at: number; readonly run: () => void; cancelled: boolean }[] = [];
  const clock: RoomClock = {
    now: () => now,
    after: (ms, run) => {
      const timer = { at: now + ms, run, cancelled: false };
      timers = [...timers, timer];
      return () => {
        timer.cancelled = true;
      };
    },
  };
  /** Moves time on, firing every timer that comes due (including ones set while firing). */
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = timers.filter((t) => !t.cancelled && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at;
      due.cancelled = true;
      due.run();
    }
    now = end;
  };
  return { clock, advance };
}

function makeRoom() {
  const inbox = new Map<string, ServerMessage[]>();
  const online = new Set<string>([HOST, GUEST]);
  const { clock, advance } = fakeClock();
  const room = new Room({
    hostToken: HOST,
    send: (token, message) => inbox.set(token, [...(inbox.get(token) ?? []), message]),
    isOnline: (token) => online.has(token),
    clock,
  });
  const of = (token: string) => inbox.get(token) ?? [];
  const last = (token: string, type: ServerMessage['type']) => of(token).filter((m) => m.type === type).at(-1);
  const send = (token: string, message: Parameters<Room['receive']>[1]) => room.receive(token, message, 7);
  const setOnline = (token: string, isOnline: boolean) => {
    if (isOnline) online.add(token);
    else online.delete(token);
    room.presenceChanged();
  };
  return { room, inbox, of, last, send, advance, setOnline };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Answers every open request with its first legal action until the match ends. */
async function playOut(ctx: ReturnType<typeof makeRoom>, tokens: readonly string[]) {
  const answered = new Set<number>();
  for (let guard = 0; guard < 5000; guard++) {
    if (tokens.some((t) => ctx.last(t, 'ended'))) return;
    for (const token of tokens) {
      const open = ctx
        .of(token)
        .flatMap((m) => (m.type === 'request' ? [m.request] : []))
        .filter((r: OnlineRequest) => !answered.has(r.id));
      for (const request of open) {
        answered.add(request.id);
        ctx.send(token, { type: 'submit', requestId: request.id, action: structuredClone(request.context.legalActions[0]!) });
      }
    }
    await tick();
  }
  throw new Error('match did not finish');
}

describe('V0.7 online room', () => {
  it('runs a lobby, fills empty seats with bots and plays a whole match', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'hello', token: HOST, protocol: PROTOCOL_VERSION });
    ctx.send(HOST, { type: 'join', name: '  房主\u0007  ' });
    ctx.send(GUEST, { type: 'join', name: '客人' });
    const lobby = ctx.last(GUEST, 'sync');
    expect(lobby?.type === 'sync' && lobby.room.members.map((m) => m.name)).toEqual(['房主', '客人']);

    ctx.send(GUEST, { type: 'start', seats: 3 });
    expect(ctx.last(GUEST, 'error')).toMatchObject({ code: 'not-host' });

    ctx.send(HOST, { type: 'start', seats: 4 });
    const started = ctx.last(HOST, 'sync');
    expect(started?.type === 'sync' && started.room.match?.players.map((p) => p.kind)).toEqual([
      'local-human',
      'remote',
      'bot',
      'bot',
    ]);

    await playOut(ctx, [HOST, GUEST]);
    const ended = ctx.last(HOST, 'ended');
    expect(ended).toMatchObject({ type: 'ended', error: null });
    expect(ended?.type === 'ended' && ended.result?.standings.length).toBe(4);
    const events = ctx.of(GUEST).flatMap((m) => (m.type === 'events' ? m.events : []));
    expect(events[0]).toMatchObject({ type: 'phase-started', phase: 'island-choice' });
    expect(events.some((e) => e.type === 'islands-chosen')).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'match-ended' });
  });

  it('speaks protocol 4 with V0.7 rules', () => {
    expect(PROTOCOL_VERSION).toBe(4);
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'hello', token: HOST, protocol: PROTOCOL_VERSION });
    const sync = ctx.last(HOST, 'sync');
    expect(sync?.type === 'sync' && [sync.room.minSeats, sync.room.maxSeats]).toEqual([3, 4]);
    ctx.send(HOST, { type: 'hello', token: HOST, protocol: 3 });
    expect(ctx.last(HOST, 'error')).toMatchObject({ code: 'outdated' });
  });

  it('starts with the island draft: each person gets only their own two offers', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: 'A' });
    ctx.send(GUEST, { type: 'join', name: 'B' });
    ctx.send(HOST, { type: 'start', seats: 3 });
    await tick();
    for (const [token, id] of [[HOST, 'p1'], [GUEST, 'p2']] as const) {
      const request = ctx.last(token, 'request');
      if (request?.type !== 'request') throw new Error('no request');
      expect(request.request.context.decision).toEqual({ playerId: id, phase: 'island-choice' });
      expect(request.request.context.legalActions).toHaveLength(2);
      const offers = ctx.of(token).flatMap((m) => (m.type === 'private' ? [m.event] : []));
      expect(offers).toEqual([expect.objectContaining({ type: 'island-offers', playerId: id })]);
    }
  });

  it('sends private events and requests only to their own seat', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: 'A' });
    ctx.send(GUEST, { type: 'join', name: 'B' });
    ctx.send(HOST, { type: 'start', seats: 3 });
    await playOut(ctx, [HOST, GUEST]);
    for (const [token, id] of [
      [HOST, 'p1'],
      [GUEST, 'p2'],
    ] as const) {
      ctx.of(token).forEach((m) => {
        if (m.type === 'private') expect(m.event.playerId).toBe(id);
        if (m.type === 'request') expect(m.request.context.decision.playerId).toBe(id);
      });
    }
  });

  it('refuses actions that were not offered and keeps the request open', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: 'A' });
    ctx.send(HOST, { type: 'start', seats: 3 });
    await tick();
    const request = ctx.last(HOST, 'request');
    if (request?.type !== 'request') throw new Error('no request');
    const forged = { ...request.request.context.legalActions[0]!, playerId: 'p2' };
    ctx.send(HOST, { type: 'submit', requestId: request.request.id, action: forged });
    expect(ctx.last(HOST, 'error')).toMatchObject({ code: 'illegal-action' });

    // A reconnect (new hello) gets the still-open request back.
    ctx.send(HOST, { type: 'hello', token: HOST, protocol: PROTOCOL_VERSION });
    const sync = ctx.last(HOST, 'sync');
    expect(sync?.type === 'sync' && sync.room.match?.requests.map((r) => r.id)).toEqual([request.request.id]);
  });

  it('tells everyone which seats are still deciding', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: 'A' });
    ctx.send(GUEST, { type: 'join', name: 'B' });
    ctx.send(HOST, { type: 'start', seats: 3 });
    await tick();
    expect(ctx.last(GUEST, 'waiting')).toEqual({ type: 'waiting', players: ['p1', 'p2'] });
    const request = ctx.last(GUEST, 'request');
    if (request?.type !== 'request') throw new Error('no request');
    ctx.send(GUEST, { type: 'submit', requestId: request.request.id, action: request.request.context.legalActions[0]! });
    expect(ctx.last(HOST, 'waiting')).toEqual({ type: 'waiting', players: ['p1'] });
    ctx.send(GUEST, { type: 'hello', token: GUEST, protocol: PROTOCOL_VERSION });
    const sync = ctx.last(GUEST, 'sync');
    expect(sync?.type === 'sync' && sync.room.match?.waitingOn).toEqual(['p1']);
  });

  it('keeps late arrivals out of a started match and tells outdated tabs to reload', () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: 'A' });
    ctx.send(HOST, { type: 'start', seats: 3 });
    ctx.send(LATE, { type: 'join', name: 'C' });
    expect(ctx.last(LATE, 'error')).toMatchObject({ code: 'already-started' });
    ctx.send(LATE, { type: 'hello', token: LATE, protocol: PROTOCOL_VERSION });
    const sync = ctx.last(LATE, 'sync');
    expect(sync?.type === 'sync' && sync.room.match?.you).toBeNull();
    ctx.send(LATE, { type: 'hello', token: LATE, protocol: PROTOCOL_VERSION + 1 });
    expect(ctx.last(LATE, 'error')).toMatchObject({ code: 'outdated' });
  });

  it('rejects seat counts below the people present or outside the rules', () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: 'A' });
    ctx.send(HOST, { type: 'start', seats: 2 });
    expect(ctx.last(HOST, 'error')).toMatchObject({ code: 'bad-seats' });
    ctx.send(HOST, { type: 'start', seats: 5 });
    expect(ctx.last(HOST, 'error')).toMatchObject({ code: 'bad-seats' });
  });
});

describe('playing again in the same room', () => {
  it('lets only the host bring a finished room back to its lobby with the same people', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: '房主' });
    ctx.send(GUEST, { type: 'join', name: '客人' });
    ctx.send(HOST, { type: 'start', seats: 3 });

    ctx.send(HOST, { type: 'rematch' });
    expect(ctx.last(HOST, 'error')).toMatchObject({ code: 'not-finished' });

    await playOut(ctx, [HOST, GUEST]);
    ctx.send(GUEST, { type: 'rematch' });
    expect(ctx.last(GUEST, 'error')).toMatchObject({ code: 'not-host' });

    ctx.send(HOST, { type: 'rematch' });
    const lobby = ctx.last(GUEST, 'sync');
    expect(lobby?.type === 'sync' && lobby.room.phase).toBe('lobby');
    expect(lobby?.type === 'sync' && lobby.room.match).toBeNull();
    expect(lobby?.type === 'sync' && lobby.room.members.map((m) => m.name)).toEqual(['房主', '客人']);
    expect(lobby?.type === 'sync' && lobby.room.joined).toBe(true);
  });

  it('starts a fresh match after the rematch and lets newcomers join the lobby', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: '房主' });
    ctx.send(HOST, { type: 'start', seats: 3 });
    await playOut(ctx, [HOST]);
    ctx.send(HOST, { type: 'rematch' });
    ctx.send(LATE, { type: 'join', name: '晚到' });
    ctx.send(HOST, { type: 'start', seats: 4 });

    const started = ctx.last(LATE, 'sync');
    expect(started?.type === 'sync' && started.room.phase).toBe('playing');
    expect(started?.type === 'sync' && started.room.match?.events).toEqual([]);
    expect(started?.type === 'sync' && started.room.match?.players.map((p) => p.kind)).toEqual(['remote', 'local-human', 'bot', 'bot']);
  });
});

describe('leaving a lobby', () => {
  it('frees the seat of whoever leaves the lobby, and refuses leaving a running match', () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: '房主' });
    ctx.send(GUEST, { type: 'join', name: '客人' });
    ctx.send(GUEST, { type: 'leave' });
    const lobby = ctx.last(HOST, 'sync');
    expect(lobby?.type === 'sync' && lobby.room.members.map((m) => m.name)).toEqual(['房主']);
    expect(ctx.last(GUEST, 'sync')).toMatchObject({ room: { joined: false } });

    ctx.send(HOST, { type: 'start', seats: 3 });
    ctx.send(HOST, { type: 'leave' });
    expect(ctx.last(HOST, 'error')).toMatchObject({ code: 'already-started' });
  });

  it('drops people who are gone when the host plays again, so the next match never waits on them', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: '房主' });
    ctx.send(GUEST, { type: 'join', name: '客人' });
    ctx.send(LATE, { type: 'join', name: '走了' });
    ctx.send(HOST, { type: 'start', seats: 3 });
    await playOut(ctx, [HOST, GUEST, LATE]);
    ctx.send(HOST, { type: 'rematch' });
    const lobby = ctx.last(GUEST, 'sync');
    // LATE is not online in makeRoom.
    expect(lobby?.type === 'sync' && lobby.room.members.map((m) => m.name)).toEqual(['房主', '客人']);
  });

  it('tells people who only watched the match that the lobby is open again', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: '房主' });
    ctx.send(HOST, { type: 'start', seats: 3 });
    ctx.send(LATE, { type: 'hello', token: LATE, protocol: PROTOCOL_VERSION });
    await playOut(ctx, [HOST]);
    ctx.send(HOST, { type: 'rematch' });
    expect(ctx.last(LATE, 'sync')).toMatchObject({ room: { phase: 'lobby', joined: false } });
  });
});

describe('protocol parsing', () => {
  it('accepts well-formed messages and drops everything else', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'hello', token: HOST, protocol: 1 }))).toMatchObject({ type: 'hello' });
    expect(parseClientMessage(JSON.stringify({ type: 'hello', token: 'short', protocol: 1 }))).toBeNull();
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'start', seats: 3.5 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'rematch' }))).toEqual({ type: 'rematch' });
    expect(parseClientMessage(JSON.stringify({ type: 'leave' }))).toEqual({ type: 'leave' });
    expect(parseClientMessage(JSON.stringify({ type: 'resume' }))).toEqual({ type: 'resume' });
    expect(parseClientMessage(JSON.stringify({ type: 'shown', requestId: 3 }))).toEqual({ type: 'shown', requestId: 3 });
    expect(parseClientMessage(JSON.stringify({ type: 'shown', requestId: 'x' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'start', seats: 3, decisionSeconds: 60 }))).toEqual({
      type: 'start',
      seats: 3,
      decisionSeconds: 60,
    });
    expect(parseClientMessage(JSON.stringify({ type: 'start', seats: 3, decisionSeconds: '60' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'submit', requestId: 1, action: [] }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'join', name: 'x'.repeat(20_000) }))).toBeNull();
  });

  it('cleans names and checks room codes', () => {
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('一二三四五六七八九十一二三四')).toBe('一二三四五六七八九十一二');
    expect(isRoomCode('ABC234')).toBe(true);
    expect(isRoomCode('ABC0O1')).toBe(false);
  });
});

/** The open requests of a token not answered yet, newest last. */
function openRequests(ctx: ReturnType<typeof makeRoom>, token: string): OnlineRequest[] {
  const sync = ctx.last(token, 'sync');
  const fromSync = sync?.type === 'sync' ? (sync.room.match?.requests ?? []) : [];
  const sent = ctx.of(token).flatMap((m) => (m.type === 'request' ? [m.request] : []));
  const waiting = ctx.last(token, 'waiting');
  const stillOwed = new Set(waiting?.type === 'waiting' ? waiting.players : []);
  return [...fromSync, ...sent].filter((r, i, all) => all.findIndex((o) => o.id === r.id) === i && stillOwed.has(r.context.decision.playerId));
}

function answer(ctx: ReturnType<typeof makeRoom>, token: string, request: OnlineRequest) {
  ctx.send(token, { type: 'submit', requestId: request.id, action: structuredClone(request.context.legalActions[0]!) });
}

/** A one-person room (plus two bots) on the island draft, with the host deciding. */
async function soloMatch(decisionSeconds?: number) {
  const ctx = makeRoom();
  ctx.send(HOST, { type: 'join', name: '房主' });
  ctx.send(HOST, decisionSeconds === undefined ? { type: 'start', seats: 3 } : { type: 'start', seats: 3, decisionSeconds });
  await tick();
  return ctx;
}

/** The table shows every open decision of `token`. */
function showOpen(ctx: ReturnType<typeof makeRoom>, token: string) {
  openRequests(ctx, token).forEach((r) => ctx.send(token, { type: 'shown', requestId: r.id }));
}

/** The open decision of `token` shows and its one-minute limit runs out. */
async function expire(ctx: ReturnType<typeof makeRoom>, token: string) {
  showOpen(ctx, token);
  ctx.advance(60_000);
  await tick();
}

const seatsOf = (ctx: ReturnType<typeof makeRoom>, token: string) => {
  const seats = ctx.last(token, 'seats');
  return seats?.type === 'seats' ? seats : null;
};

describe('decision time limits and takeover (game-design §15)', () => {
  it('starts the host-picked limit (two minutes by default) once the table shows the decision', async () => {
    const ctx = await soloMatch();
    const [request] = openRequests(ctx, HOST);
    expect(request?.timeLeftMs).toBeNull();
    const sync = ctx.last(HOST, 'sync');
    expect(sync?.type === 'sync' && sync.room.match?.decisionSeconds).toBe(120);
    ctx.advance(30_000);
    ctx.send(HOST, { type: 'shown', requestId: request!.id });
    expect(ctx.last(HOST, 'clock')).toEqual({ type: 'clock', requestId: request!.id, timeLeftMs: DEFAULT_DECISION_SECONDS * 1000 });

    const fast = await soloMatch(60);
    showOpen(fast, HOST);
    expect(fast.last(HOST, 'clock')).toMatchObject({ timeLeftMs: 60_000 });
  });

  it('starts the clock anyway when the table has not shown the decision within the cap', async () => {
    const ctx = await soloMatch(60);
    ctx.advance(DECISION_SHOW_CAP_SECONDS * 1000 - 1);
    expect(ctx.last(HOST, 'clock')).toBeUndefined();
    ctx.advance(1);
    expect(ctx.last(HOST, 'clock')).toMatchObject({ timeLeftMs: 60_000 });
    await expire(ctx, HOST);
    expect(ctx.last(HOST, 'timed-out')).toMatchObject({ phase: 'island-choice' });
  });

  it('refuses a time limit that is not on offer', () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: '房主' });
    ctx.send(HOST, { type: 'start', seats: 3, decisionSeconds: 90 });
    expect(ctx.last(HOST, 'error')).toMatchObject({ code: 'bad-time-limit' });
  });

  it('lets a bot pick the island when time runs out, and counts it as a timeout', async () => {
    const ctx = await soloMatch(60);
    await expire(ctx, HOST);
    expect(ctx.last(HOST, 'timed-out')).toEqual({ type: 'timed-out', phase: 'island-choice', takeover: false });
    const events = ctx.of(HOST).flatMap((m) => (m.type === 'events' ? m.events : []));
    expect(events.some((e) => e.type === 'islands-chosen')).toBe(true);
    const next = openRequests(ctx, HOST).at(-1);
    expect(next?.context.decision.phase).toBe('invest');
    ctx.send(HOST, { type: 'hello', token: HOST, protocol: PROTOCOL_VERSION });
    const after = ctx.last(HOST, 'sync');
    expect(after?.type === 'sync' && after.room.match?.timeouts).toBe(1);
  });

  it('stays in port when an invest decision times out', async () => {
    const ctx = await soloMatch(60);
    answer(ctx, HOST, openRequests(ctx, HOST)[0]!);
    await tick();
    expect(openRequests(ctx, HOST).at(-1)?.context.decision.phase).toBe('invest');
    await expire(ctx, HOST);
    expect(ctx.last(HOST, 'timed-out')).toEqual({ type: 'timed-out', phase: 'invest', takeover: false });
    const events = ctx.of(HOST).flatMap((m) => (m.type === 'events' ? m.events : []));
    const launch = events.find((e) => e.type === 'ships-launched');
    expect(launch?.type === 'ships-launched' && launch.stayedInPort).toContain('p1');
  });

  it('hands the seat to a bot after two timeouts in a row, and the person can take it back', async () => {
    const ctx = await soloMatch(60);
    await expire(ctx, HOST);
    await expire(ctx, HOST);
    expect(ctx.last(HOST, 'timed-out')).toMatchObject({ takeover: true });

    // The only person is under takeover: nobody decides, so the match pauses instead of the bots
    // racing to the end. 「取消託管」 lets it go on, with the full limit.
    expect(seatsOf(ctx, HOST)).toEqual({ type: 'seats', takeover: ['p1'], paused: true });
    for (let i = 0; i < 20; i++) await tick();
    expect(ctx.last(HOST, 'ended')).toBeUndefined();
    ctx.send(HOST, { type: 'resume' });
    expect(seatsOf(ctx, HOST)).toEqual({ type: 'seats', takeover: [], paused: false });
    await tick();
    showOpen(ctx, HOST);
    expect(ctx.last(HOST, 'clock')).toMatchObject({ timeLeftMs: 60_000 });
  });

  it('lets the bot play a taken-over seat while another person still decides', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: '房主' });
    ctx.send(GUEST, { type: 'join', name: '客人' });
    ctx.send(HOST, { type: 'start', seats: 3, decisionSeconds: 60 });
    await tick();
    answer(ctx, GUEST, openRequests(ctx, GUEST)[0]!);
    await expire(ctx, HOST);
    answer(ctx, GUEST, openRequests(ctx, GUEST).at(-1)!);
    await expire(ctx, HOST);
    expect(seatsOf(ctx, GUEST)).toEqual({ type: 'seats', takeover: ['p1'], paused: false });
    // The host's next decisions are made at once: only the guest is waited on.
    expect(ctx.last(GUEST, 'waiting')).toEqual({ type: 'waiting', players: ['p2'] });
  });

  it('resets the count when the person decides in between', async () => {
    const ctx = await soloMatch(60);
    await expire(ctx, HOST);
    answer(ctx, HOST, openRequests(ctx, HOST).at(-1)!);
    await tick();
    await expire(ctx, HOST);
    expect(ctx.last(HOST, 'timed-out')).toMatchObject({ takeover: false });
    expect(seatsOf(ctx, HOST)?.takeover ?? []).toEqual([]);
  });

  it('gives the decisions back after 「取消託管」, with the count at zero', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: '房主' });
    ctx.send(GUEST, { type: 'join', name: '客人' });
    ctx.send(HOST, { type: 'start', seats: 3, decisionSeconds: 60 });
    await tick();
    // The guest drops: after the grace period their draft goes to the bot and they are under takeover.
    ctx.setOnline(GUEST, false);
    ctx.advance(14_000);
    expect(seatsOf(ctx, HOST)).toBeNull();
    ctx.advance(1_000);
    await tick();
    expect(seatsOf(ctx, HOST)).toEqual({ type: 'seats', takeover: ['p2'], paused: false });
    expect(ctx.last(HOST, 'waiting')).toEqual({ type: 'waiting', players: ['p1'] });

    ctx.setOnline(GUEST, true);
    ctx.send(GUEST, { type: 'hello', token: GUEST, protocol: PROTOCOL_VERSION });
    const back = ctx.last(GUEST, 'sync');
    expect(back?.type === 'sync' && back.room.match?.takeover).toEqual(['p2']);

    ctx.send(GUEST, { type: 'resume' });
    expect(seatsOf(ctx, HOST)?.takeover).toEqual([]);
    const resumed = ctx.last(GUEST, 'sync');
    expect(resumed?.type === 'sync' && resumed.room.match?.timeouts).toBe(0);

    // The host's draft settles the phase; the guest is asked to invest themself.
    answer(ctx, HOST, openRequests(ctx, HOST)[0]!);
    await tick();
    expect(openRequests(ctx, GUEST).at(-1)?.context.decision).toEqual({ playerId: 'p2', phase: 'invest' });
  });

  it('pauses with nobody connected: no clock runs and no bot moves until someone is back', async () => {
    const ctx = await soloMatch(60);
    showOpen(ctx, HOST);
    ctx.setOnline(HOST, false);
    ctx.advance(10 * 60_000);
    await tick();
    expect(ctx.last(HOST, 'timed-out')).toBeUndefined();
    const events = ctx.of(HOST).flatMap((m) => (m.type === 'events' ? m.events : []));
    expect(events.some((e) => e.type === 'islands-chosen')).toBe(false);

    // Back again: the match goes on and the host decides themself, with the full limit.
    ctx.setOnline(HOST, true);
    ctx.send(HOST, { type: 'hello', token: HOST, protocol: PROTOCOL_VERSION });
    const sync = ctx.last(HOST, 'sync');
    expect(sync?.type === 'sync' && sync.room.match?.paused).toBe(false);
    expect(sync?.type === 'sync' && sync.room.match?.takeover).toEqual([]);
    expect(sync?.type === 'sync' && sync.room.match?.requests[0]?.timeLeftMs).toBe(60_000);
  });

  it('gives a fresh full limit to a person still seated when the match goes on', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: '房主' });
    ctx.send(GUEST, { type: 'join', name: '客人' });
    ctx.send(HOST, { type: 'start', seats: 3, decisionSeconds: 60 });
    await tick();
    showOpen(ctx, GUEST);
    ctx.advance(30_000);
    ctx.setOnline(HOST, false);
    ctx.setOnline(GUEST, false);
    ctx.advance(10 * 60_000);
    ctx.setOnline(GUEST, true);
    // Both left inside the grace period, so the pause kept both out of takeover; the host, still
    // gone, gets a fresh grace period and then a bot.
    expect(seatsOf(ctx, GUEST)?.takeover).toEqual([]);
    const sync = ctx.last(GUEST, 'sync');
    const draft = sync?.type === 'sync' ? sync.room.match?.requests.find((r) => r.context.decision.phase === 'island-choice') : undefined;
    expect(draft?.timeLeftMs).toBe(60_000);
    ctx.advance(15_000);
    expect(seatsOf(ctx, GUEST)?.takeover).toEqual(['p1']);
  });

  it('keeps a seat out of takeover when its person is back within the grace period', async () => {
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'join', name: '房主' });
    ctx.send(GUEST, { type: 'join', name: '客人' });
    ctx.send(HOST, { type: 'start', seats: 3, decisionSeconds: 60 });
    await tick();
    showOpen(ctx, GUEST);
    ctx.setOnline(GUEST, false);
    ctx.advance(10_000);
    ctx.setOnline(GUEST, true);
    ctx.advance(30_000);
    expect(seatsOf(ctx, HOST)?.takeover ?? []).toEqual([]);
    // Their decision kept counting meanwhile: 20 s of the minute are left.
    ctx.send(GUEST, { type: 'hello', token: GUEST, protocol: PROTOCOL_VERSION });
    const sync = ctx.last(GUEST, 'sync');
    expect(sync?.type === 'sync' && sync.room.match?.requests[0]?.timeLeftMs).toBe(20_000);
  });
});
