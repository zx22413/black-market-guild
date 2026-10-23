import { describe, expect, it } from 'vitest';
import {
  PROTOCOL_VERSION,
  Room,
  cleanName,
  isRoomCode,
  parseClientMessage,
  type OnlineRequest,
  type ServerMessage,
} from '../../../src/v07/online';

const HOST = 'host-token-0000000001';
const GUEST = 'guest-token-000000002';
const LATE = 'late-token-0000000003';

function makeRoom() {
  const inbox = new Map<string, ServerMessage[]>();
  const online = new Set<string>([HOST, GUEST]);
  const room = new Room({
    hostToken: HOST,
    send: (token, message) => inbox.set(token, [...(inbox.get(token) ?? []), message]),
    isOnline: (token) => online.has(token),
  });
  const of = (token: string) => inbox.get(token) ?? [];
  const last = (token: string, type: ServerMessage['type']) => of(token).filter((m) => m.type === type).at(-1);
  const send = (token: string, message: Parameters<Room['receive']>[1]) => room.receive(token, message, 7);
  return { room, inbox, of, last, send };
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

  it('speaks protocol 3 with V0.7 rules', () => {
    expect(PROTOCOL_VERSION).toBe(3);
    const ctx = makeRoom();
    ctx.send(HOST, { type: 'hello', token: HOST, protocol: PROTOCOL_VERSION });
    const sync = ctx.last(HOST, 'sync');
    expect(sync?.type === 'sync' && [sync.room.minSeats, sync.room.maxSeats]).toEqual([3, 4]);
    ctx.send(HOST, { type: 'hello', token: HOST, protocol: 2 });
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
