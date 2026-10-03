import type { BotStrategy } from '../bots';
import { RULES_V06, type Action, type MatchEvent, type MatchResult, type PlayerId, type PrivateEvent } from '../game';
import { botController, runMatch, setupFromSeats, type Controller, type SeatConfig } from '../match';
import {
  PROTOCOL_VERSION,
  cleanName,
  type ClientMessage,
  type ErrorCode,
  type OnlineMatch,
  type OnlineRequest,
  type RoomPhase,
  type RoomSnapshot,
  type ServerMessage,
} from './protocol';

/** Bots that fill the seats nobody joined, in the order of the local "1 對 3" preset. */
const FILL_BOTS: readonly { readonly name: string; readonly strategy: BotStrategy }[] = [
  { name: '黑潮會', strategy: 'balanced' },
  { name: '金錨公會', strategy: 'aggressive' },
  { name: '霧港商團', strategy: 'opportunist' },
  { name: '凡德商行', strategy: 'cautious' },
];

interface Member {
  readonly token: string;
  readonly name: string;
}

interface Pending {
  readonly token: string;
  readonly request: OnlineRequest;
  readonly resolve: (action: Action) => void;
}

interface MatchRecord {
  readonly players: readonly { readonly id: PlayerId; readonly name: string; readonly token: string | null }[];
  readonly startingCash: number;
  events: readonly MatchEvent[];
  privateEvents: readonly PrivateEvent[];
  result: MatchResult | null;
  error: string | null;
}

export interface RoomOptions {
  readonly hostToken: string;
  /** Sends a message to every open connection of a token. */
  readonly send: (token: string, message: ServerMessage) => void;
  /** Tokens with at least one open connection. */
  readonly isOnline: (token: string) => boolean;
}

/**
 * One online room: a lobby, then a match played with the match runner. People are known by a
 * random token their browser keeps, so a reload or a dropped phone connection gets the same
 * seat back. Nobody times out: a match waits for every seat (docs/architecture.md §7.2 is open).
 */
export class Room {
  private phase: RoomPhase = 'lobby';
  private members: readonly Member[] = [];
  private match: MatchRecord | null = null;
  private pending: readonly Pending[] = [];
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
        this.sync(token);
        return;
      case 'join':
        this.join(token, message.name);
        return;
      case 'start':
        this.start(token, message.seats, seed);
        return;
      case 'submit':
        this.submit(token, message.requestId, message.action);
        return;
    }
  }

  /** Lets everyone see who is connected right now. */
  presenceChanged(): void {
    if (this.phase === 'lobby') this.syncAll();
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
      minSeats: RULES_V06.players.min,
      maxSeats: RULES_V06.players.max,
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
      requests: this.pending.filter((p) => p.token === token).map((p) => p.request),
      waitingOn: this.waitingOn(),
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
    if (this.members.length >= RULES_V06.players.max) {
      this.fail(token, 'room-full', '房間已滿');
      return;
    }
    this.members = [...this.members, { token, name }];
    this.syncAll();
  }

  private start(token: string, seats: number, seed: number): void {
    if (token !== this.options.hostToken) {
      this.fail(token, 'not-host', '只有房主可以開始對局');
      return;
    }
    if (this.phase !== 'lobby') {
      this.fail(token, 'already-started', '對局已經開始');
      return;
    }
    const { min, max } = RULES_V06.players;
    if (seats < Math.max(min, this.members.length) || seats > max) {
      this.fail(token, 'bad-seats', `座位數需介於 ${Math.max(min, this.members.length)} 到 ${max}`);
      return;
    }
    const bots = FILL_BOTS.slice(0, seats - this.members.length);
    const seatConfigs: SeatConfig[] = [
      ...this.members.map((m): SeatConfig => ({ kind: 'remote', name: m.name })),
      ...bots.map((b): SeatConfig => ({ kind: 'bot', name: b.name, strategy: b.strategy })),
    ];
    const setup = setupFromSeats({ seed, seats: seatConfigs });
    const match: MatchRecord = {
      players: setup.players.map((p, i) => ({ ...p, token: this.members[i]?.token ?? null })),
      startingCash: (setup.rules ?? RULES_V06).startingCash,
      events: [],
      privateEvents: [],
      result: null,
      error: null,
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
        inner.onEvents?.(events);
      },
    };

    runMatch(setup, controllers).then(
      (log) => this.end(match, log.result, null),
      (error: unknown) => this.end(match, null, error instanceof Error ? error.message : String(error)),
    );
  }

  private seatController(match: MatchRecord, token: string): Controller {
    return {
      decide: (context) =>
        new Promise<Action>((resolve) => {
          const request = { id: this.nextRequestId++, context };
          this.pending = [...this.pending, { token, request, resolve }];
          this.options.send(token, { type: 'request', request });
          this.broadcast({ type: 'waiting', players: this.waitingOn() });
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
    this.pending = this.pending.filter((p) => p !== pending);
    this.broadcast({ type: 'waiting', players: this.waitingOn() });
    pending.resolve(legal);
  }

  private end(match: MatchRecord, result: MatchResult | null, error: string | null): void {
    match.result = result;
    match.error = error;
    this.phase = 'finished';
    this.pending = [];
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
    return [...new Set([this.options.hostToken, ...this.members.map((m) => m.token)])];
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
