import { createBot, type Bot, type BotStrategy, type DecisionContext } from '../bots';
import { RULES_V07, type Action, type MatchEvent, type MatchResult, type PlayerId, type PrivateEvent } from '../game';
import { botController, runMatch, setupFromSeats, type Controller, type SeatConfig } from '../match';
import {
  DECISION_SECONDS_CHOICES,
  DEFAULT_DECISION_SECONDS,
  DISCONNECT_GRACE_SECONDS,
  PROTOCOL_VERSION,
  TAKEOVER_AFTER_TIMEOUTS,
  cleanName,
  type ClientMessage,
  type ErrorCode,
  type OnlineMatch,
  type OnlineRequest,
  type RoomPhase,
  type RoomSnapshot,
  type ServerMessage,
} from './protocol';
import { timeoutAction } from './timeout';

/** Bots that fill the seats nobody joined (V0.7 personalities). */
const FILL_BOTS: readonly { readonly name: string; readonly strategy: BotStrategy }[] = [
  { name: '黑潮會', strategy: 'balanced' },
  { name: '金錨公會', strategy: 'aggressive' },
  { name: '霧港商團', strategy: 'builder' },
  { name: '凡德商行', strategy: 'cautious' },
];

/** The bot that plays for a seat under takeover (docs/game-design.md §15.2). */
const TAKEOVER_STRATEGY: BotStrategy = 'cautious';

interface Member {
  readonly token: string;
  readonly name: string;
}

/** A decision a person owes; `deadline` is null while the match is paused. */
interface Pending {
  readonly token: string;
  readonly request: Omit<OnlineRequest, 'timeLeftMs'>;
  readonly resolve: (action: Action) => void;
  readonly deadline: number | null;
  readonly cancel: (() => void) | null;
}

interface MatchRecord {
  readonly seed: number;
  readonly decisionSeconds: number;
  readonly players: readonly { readonly id: PlayerId; readonly name: string; readonly token: string | null }[];
  readonly startingCash: number;
  events: readonly MatchEvent[];
  privateEvents: readonly PrivateEvent[];
  result: MatchResult | null;
  error: string | null;
  takeover: ReadonlySet<PlayerId>;
  /** Timeouts in a row per seat (§15.2). */
  timeouts: Readonly<Record<PlayerId, number>>;
  /** Takeover bots made so far; they keep hearing every public event once made. */
  bots: ReadonlyMap<PlayerId, Bot>;
  /** Seats whose person dropped and is inside the grace period; each cancels its timer. */
  grace: ReadonlyMap<PlayerId, () => void>;
  paused: boolean;
}

/** Time for decision limits; injected so the room stays free of host APIs and tests can fast-forward. */
export interface RoomClock {
  now(): number;
  /** Runs `run` after `ms`; the returned function cancels it. */
  after(ms: number, run: () => void): () => void;
}

export interface RoomOptions {
  readonly hostToken: string;
  /** Sends a message to every open connection of a token. */
  readonly send: (token: string, message: ServerMessage) => void;
  /** Tokens with at least one open connection. */
  readonly isOnline: (token: string) => boolean;
  readonly clock: RoomClock;
}

/**
 * One online room: a lobby, then a match played with the match runner. People are known by a
 * random token their browser keeps, so a reload or a dropped phone connection gets the same
 * seat back. Every decision is timed, and a seat that times out twice in a row or stays dropped goes to
 * a bot until its person takes it back; with nobody connected the match pauses (docs/game-design.md §15).
 */
export class Room {
  private phase: RoomPhase = 'lobby';
  private members: readonly Member[] = [];
  private match: MatchRecord | null = null;
  private pending: readonly Pending[] = [];
  /** Everyone who said hello, members or not, so watchers also learn when the lobby reopens. */
  private seen: ReadonlySet<string> = new Set();
  private nextRequestId = 1;

  constructor(private readonly options: RoomOptions) {}

  /** Handles one parsed message from a connection that already said hello with `token`. */
  receive(token: string, message: ClientMessage, seed: number): void {
    switch (message.type) {
      case 'hello':
        if (message.protocol !== PROTOCOL_VERSION) {
          this.fail(token, 'outdated', '遊戲已更新，請重新整理頁面');
          return;
        }
        this.seen = new Set([...this.seen, token]);
        this.sync(token);
        return;
      case 'join':
        this.join(token, message.name);
        return;
      case 'start':
        this.start(token, message.seats, message.decisionSeconds ?? DEFAULT_DECISION_SECONDS, seed);
        return;
      case 'resume':
        this.resume(token);
        return;
      case 'rematch':
        this.rematch(token);
        return;
      case 'leave':
        this.leave(token);
        return;
      case 'submit':
        this.submit(token, message.requestId, message.action);
        return;
    }
  }

  /** Lets everyone see who is connected right now; in a match, drops go to takeover or pause it. */
  presenceChanged(): void {
    if (this.phase === 'lobby') this.syncAll();
    const match = this.match;
    if (this.phase !== 'playing' || !match) return;
    if (this.nobodyHere(match)) {
      if (!match.paused) this.pause(match);
      return;
    }
    const wasPaused = match.paused;
    match.paused = false;
    match.players.forEach((p) => {
      if (p.token === null) return;
      if (this.options.isOnline(p.token)) this.endGrace(match, p.id);
      else this.startGrace(match, p.id);
    });
    if (wasPaused) {
      this.pending.forEach((p) => this.dispatch(match, p));
      this.broadcastSeats(match);
      this.syncAll();
    }
  }

  snapshotFor(token: string): RoomSnapshot {
    return {
      phase: this.phase,
      members: this.members.map((m) => ({
        name: m.name,
        isHost: m.token === this.options.hostToken,
        online: this.options.isOnline(m.token),
      })),
      joined: this.members.some((m) => m.token === token),
      isHost: token === this.options.hostToken,
      minSeats: RULES_V07.players.min,
      maxSeats: RULES_V07.players.max,
      match: this.match ? this.matchFor(token, this.match) : null,
    };
  }

  private matchFor(token: string, match: MatchRecord): OnlineMatch {
    const you = match.players.find((p) => p.token === token)?.id ?? null;
    return {
      you,
      players: match.players.map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.token === null ? 'bot' : p.token === token ? 'local-human' : 'remote',
      })),
      events: match.events,
      privateEvents: match.privateEvents.filter((e) => e.playerId === you),
      requests: this.pending.filter((p) => p.token === token).map((p) => this.wire(p)),
      waitingOn: this.waitingOn(),
      takeover: match.players.map((p) => p.id).filter((id) => match.takeover.has(id)),
      paused: match.paused,
      decisionSeconds: match.decisionSeconds,
      timeouts: you === null ? 0 : (match.timeouts[you] ?? 0),
      startingCash: match.startingCash,
      result: match.result,
      error: match.error,
    };
  }

  private join(token: string, rawName: string): void {
    const name = cleanName(rawName);
    if (name === null) {
      this.fail(token, 'bad-name', '請輸入名稱');
      return;
    }
    const existing = this.members.find((m) => m.token === token);
    if (existing) {
      if (this.phase === 'lobby') {
        this.members = this.members.map((m) => (m.token === token ? { token, name } : m));
        this.syncAll();
      }
      return;
    }
    if (this.phase !== 'lobby') {
      this.fail(token, 'already-started', '對局已經開始，無法加入');
      return;
    }
    if (this.members.length >= RULES_V07.players.max) {
      this.fail(token, 'room-full', '房間已滿');
      return;
    }
    this.members = [...this.members, { token, name }];
    this.syncAll();
  }

  private start(token: string, seats: number, decisionSeconds: number, seed: number): void {
    if (token !== this.options.hostToken) {
      this.fail(token, 'not-host', '只有房主可以開始對局');
      return;
    }
    if (this.phase !== 'lobby') {
      this.fail(token, 'already-started', '對局已經開始');
      return;
    }
    const { min, max } = RULES_V07.players;
    if (seats < Math.max(min, this.members.length) || seats > max) {
      this.fail(token, 'bad-seats', `座位數需介於 ${Math.max(min, this.members.length)} 到 ${max}`);
      return;
    }
    if (!(DECISION_SECONDS_CHOICES as readonly number[]).includes(decisionSeconds)) {
      this.fail(token, 'bad-time-limit', `限時只能選 ${DECISION_SECONDS_CHOICES.join('、')} 秒`);
      return;
    }
    const bots = FILL_BOTS.slice(0, seats - this.members.length);
    const seatConfigs: SeatConfig[] = [
      ...this.members.map((m): SeatConfig => ({ kind: 'remote', name: m.name })),
      ...bots.map((b): SeatConfig => ({ kind: 'bot', name: b.name, strategy: b.strategy })),
    ];
    const setup = setupFromSeats({ seed, seats: seatConfigs });
    const match: MatchRecord = {
      seed,
      decisionSeconds,
      players: setup.players.map((p, i) => ({ ...p, token: this.members[i]?.token ?? null })),
      startingCash: (setup.rules ?? RULES_V07).startingCash,
      events: [],
      privateEvents: [],
      result: null,
      error: null,
      takeover: new Set(),
      timeouts: {},
      bots: new Map(),
      grace: new Map(),
      paused: false,
    };
    this.match = match;
    this.phase = 'playing';
    this.syncAll();

    const controllers: Record<PlayerId, Controller> = {};
    match.players.forEach(({ id, token: seatToken }) => {
      const bot = setup.bots[id];
      controllers[id] = bot ? botController(bot) : this.seatController(match, seatToken!);
    });
    // Public events reach every seat; record and broadcast them once, through the first seat.
    const first = match.players[0]!.id;
    const inner = controllers[first]!;
    controllers[first] = {
      ...inner,
      onEvents: (events) => {
        match.events = [...match.events, ...events];
        this.broadcast({ type: 'events', events });
        match.bots.forEach((bot) => bot.onEvents?.(events));
        inner.onEvents?.(events);
      },
    };

    runMatch(setup, controllers).then(
      (log) => this.end(match, log.result, null),
      (error: unknown) => this.end(match, null, error instanceof Error ? error.message : String(error)),
    );
  }

  /** Back to the lobby after a finished match; members stay joined and newcomers may join again. */
  private rematch(token: string): void {
    if (token !== this.options.hostToken) {
      this.fail(token, 'not-host', '只有房主可以再開一局');
      return;
    }
    if (this.phase !== 'finished') {
      this.fail(token, 'not-finished', '這一局還沒結束');
      return;
    }
    this.phase = 'lobby';
    this.match = null;
    // Nobody waits for someone who already went home; they can sit down again if they come back.
    this.members = this.members.filter((m) => m.token === token || this.options.isOnline(m.token));
    this.syncAll();
  }

  /** 「取消託管」: the seat's person decides again from the next decision on (§15.2). */
  private resume(token: string): void {
    const match = this.match;
    const seat = match?.players.find((p) => p.token === token)?.id;
    if (!match || seat === undefined || this.phase !== 'playing' || !match.takeover.has(seat)) return;
    match.takeover = new Set([...match.takeover].filter((id) => id !== seat));
    match.timeouts = { ...match.timeouts, [seat]: 0 };
    this.broadcastSeats(match);
    this.sync(token);
  }

  private leave(token: string): void {
    if (this.phase !== 'lobby') {
      this.fail(token, 'already-started', '對局已經開始，座位會保留');
      return;
    }
    this.members = this.members.filter((m) => m.token !== token);
    this.syncAll();
    // The leaver is no longer a member; make sure they see their seat is gone.
    if (!this.knownTokens().includes(token)) this.sync(token);
  }

  private seatController(match: MatchRecord, token: string): Controller {
    return {
      decide: (context) =>
        new Promise<Action>((resolve) => {
          const request = { id: this.nextRequestId++, context };
          const entry: Pending = { token, request, resolve, deadline: null, cancel: null };
          this.pending = [...this.pending, entry];
          this.dispatch(match, entry);
        }),
      onPrivateEvent: (event) => {
        match.privateEvents = [...match.privateEvents, event];
        this.options.send(token, { type: 'private', event });
      },
    };
  }

  private submit(token: string, requestId: number, action: Action): void {
    const pending = this.pending.find((p) => p.request.id === requestId && p.token === token);
    if (!pending) {
      this.fail(token, 'stale-request', '這個決定已經送出或失效');
      this.sync(token);
      return;
    }
    // Only an action the engine offered is accepted, compared by value since it crossed the wire.
    const wire = JSON.stringify(action);
    const legal = pending.request.context.legalActions.find((a) => JSON.stringify(a) === wire);
    if (!legal) {
      this.fail(token, 'illegal-action', '這個行動不合法');
      this.sync(token);
      return;
    }
    const seat = pending.request.context.decision.playerId;
    if (this.match) this.match.timeouts = { ...this.match.timeouts, [seat]: 0 };
    this.settle(pending, legal);
  }

  /**
   * Routes an owed decision: nothing while paused, to the takeover bot for a seat under takeover or
   * whose person is gone, otherwise to the person with a fresh full time limit.
   */
  private dispatch(match: MatchRecord, pending: Pending): void {
    pending.cancel?.();
    const seat = pending.request.context.decision.playerId;
    if (match.paused) {
      this.replace(pending, { ...pending, deadline: null, cancel: null });
      return;
    }
    if (!this.options.isOnline(pending.token)) this.startGrace(match, seat);
    if (match.takeover.has(seat)) {
      this.settle(pending, this.botAction(match, pending.request.context));
      return;
    }
    const ms = match.decisionSeconds * 1000;
    const fresh: Pending = {
      ...pending,
      deadline: this.options.clock.now() + ms,
      cancel: this.options.clock.after(ms, () => this.timeOut(match, pending.request.id)),
    };
    this.replace(pending, fresh);
    this.options.send(fresh.token, { type: 'request', request: this.wire(fresh) });
    this.broadcast({ type: 'waiting', players: this.waitingOn() });
  }

  /** Time ran out: play the default, count it, and hand the seat to a bot after enough in a row. */
  private timeOut(match: MatchRecord, requestId: number): void {
    const pending = this.pending.find((p) => p.request.id === requestId);
    if (!pending || this.match !== match) return;
    const context = pending.request.context;
    const seat = context.decision.playerId;
    const timeouts = (match.timeouts[seat] ?? 0) + 1;
    match.timeouts = { ...match.timeouts, [seat]: timeouts };
    const action = timeoutAction(context.legalActions) ?? this.botAction(match, context);
    const takeover = timeouts >= TAKEOVER_AFTER_TIMEOUTS;
    if (takeover) {
      this.enterTakeover(match, seat);
      this.broadcastSeats(match);
    }
    this.options.send(pending.token, { type: 'timed-out', phase: context.decision.phase, takeover });
    this.settle(pending, action);
  }

  private settle(pending: Pending, action: Action): void {
    pending.cancel?.();
    this.pending = this.pending.filter((p) => p.request.id !== pending.request.id);
    this.broadcast({ type: 'waiting', players: this.waitingOn() });
    pending.resolve(action);
  }

  /** True when the seat was not under takeover yet. */
  private enterTakeover(match: MatchRecord, seat: PlayerId): boolean {
    if (match.takeover.has(seat)) return false;
    match.takeover = new Set([...match.takeover, seat]);
    return true;
  }

  /** The takeover bot's choice; made on first use and told every public event so far. */
  private botAction(match: MatchRecord, context: DecisionContext): Action {
    const seat = context.decision.playerId;
    let bot = match.bots.get(seat);
    if (!bot) {
      const index = match.players.findIndex((p) => p.id === seat);
      bot = createBot(TAKEOVER_STRATEGY, (Math.imul(match.seed, 37) + index + 101) | 0);
      if (match.events.length > 0) bot.onEvents?.(match.events);
      match.bots = new Map([...match.bots, [seat, bot]]);
    }
    return bot.decide(context);
  }

  /** A seat's person dropped: after the grace period, if still gone, a bot takes the seat (§15.2). */
  private startGrace(match: MatchRecord, seat: PlayerId): void {
    if (match.takeover.has(seat) || match.grace.has(seat)) return;
    const cancel = this.options.clock.after(DISCONNECT_GRACE_SECONDS * 1000, () => {
      match.grace = new Map([...match.grace].filter(([id]) => id !== seat));
      if (this.match !== match || match.paused || !this.enterTakeover(match, seat)) return;
      this.broadcastSeats(match);
      this.pending.filter((p) => p.request.context.decision.playerId === seat).forEach((p) => this.dispatch(match, p));
    });
    match.grace = new Map([...match.grace, [seat, cancel]]);
  }

  private endGrace(match: MatchRecord, seat: PlayerId): void {
    match.grace.get(seat)?.();
    match.grace = new Map([...match.grace].filter(([id]) => id !== seat));
  }

  private nobodyHere(match: MatchRecord): boolean {
    return !match.players.some((p) => p.token !== null && this.options.isOnline(p.token));
  }

  /** Nobody is connected: stop every clock and let no bot move until someone is back (§15.2). */
  private pause(match: MatchRecord): void {
    match.paused = true;
    match.grace.forEach((cancel) => cancel());
    match.grace = new Map();
    this.pending.forEach((p) => {
      p.cancel?.();
      this.replace(p, { ...p, deadline: null, cancel: null });
    });
  }

  private replace(old: Pending, next: Pending): void {
    this.pending = this.pending.map((p) => (p.request.id === old.request.id ? next : p));
  }

  private wire(pending: Pending): OnlineRequest {
    const timeLeftMs = pending.deadline === null ? null : Math.max(0, pending.deadline - this.options.clock.now());
    return { ...pending.request, timeLeftMs };
  }

  private broadcastSeats(match: MatchRecord): void {
    const takeover = match.players.map((p) => p.id).filter((id) => match.takeover.has(id));
    this.broadcast({ type: 'seats', takeover, paused: match.paused });
  }

  private end(match: MatchRecord, result: MatchResult | null, error: string | null): void {
    match.result = result;
    match.error = error;
    this.phase = 'finished';
    this.pending.forEach((p) => p.cancel?.());
    this.pending = [];
    match.grace.forEach((cancel) => cancel());
    match.grace = new Map();
    this.broadcast({ type: 'ended', result, error });
  }

  /** Seats with an unanswered decision, in seat order; public like `submittedPlayerIds`. */
  private waitingOn(): readonly PlayerId[] {
    const seats = new Set(this.pending.map((p) => p.request.context.decision.playerId));
    return (this.match?.players ?? []).map((p) => p.id).filter((id) => seats.has(id));
  }

  private broadcast(message: ServerMessage): void {
    this.knownTokens().forEach((token) => this.options.send(token, message));
  }

  private knownTokens(): readonly string[] {
    return [...new Set([this.options.hostToken, ...this.members.map((m) => m.token), ...this.seen])];
  }

  private sync(token: string): void {
    this.options.send(token, { type: 'sync', room: this.snapshotFor(token) });
  }

  private syncAll(): void {
    this.knownTokens().forEach((token) => this.sync(token));
  }

  private fail(token: string, code: ErrorCode, message: string): void {
    this.options.send(token, { type: 'error', code, message });
  }
}
