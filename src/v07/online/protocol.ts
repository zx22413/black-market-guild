import type { DecisionContext } from '../bots';
import type { Action, DecisionPhase, MatchEvent, MatchResult, PlayerId, PrivateEvent } from '../game';

/** Bumped whenever messages change shape; a stale tab is told to reload. 2 = V0.7 rules, 3 = rematch, 4 = timers and takeover. */
export const PROTOCOL_VERSION = 4;

/** Largest client message the server reads; actions are small JSON objects. */
export const MAX_MESSAGE_BYTES = 16_384;

export const NAME_MAX_LENGTH = 12;

/** Decision time limits the host may pick (docs/game-design.md §15.1). */
export const DECISION_SECONDS_CHOICES = [60, 120, 300] as const;
export const DEFAULT_DECISION_SECONDS = 120;
/** Timeouts in a row that put a seat under bot takeover (§15.2). */
export const TAKEOVER_AFTER_TIMEOUTS = 2;
/** The clock starts when the table shows a decision, or this long after it was sent at the latest (§15.1). */
export const DECISION_SHOW_CAP_SECONDS = 90;
/** A dropped connection goes to takeover only after this long, so a reload does not (§15.2). */
export const DISCONNECT_GRACE_SECONDS = 15;

/** Room codes avoid look-alike characters (0/O, 1/I/L) so they can be read aloud. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export type RoomPhase = 'lobby' | 'playing' | 'finished';

export interface RoomMemberInfo {
  readonly name: string;
  readonly isHost: boolean;
  readonly online: boolean;
}

export interface OnlinePlayer {
  readonly id: PlayerId;
  readonly name: string;
  /** 'local-human' is the receiving seat itself; other people are 'remote'. */
  readonly kind: 'local-human' | 'remote' | 'bot';
}

export interface OnlineRequest {
  readonly id: number;
  readonly context: DecisionContext;
  /** Milliseconds left when the server sent it; null while its clock is not running (not shown yet, or paused). */
  readonly timeLeftMs: number | null;
}

/** One seat's view of a running or finished match. */
export interface OnlineMatch {
  /** The receiving seat; null for someone who did not join before the start. */
  readonly you: PlayerId | null;
  readonly players: readonly OnlinePlayer[];
  readonly events: readonly MatchEvent[];
  /** Private events addressed to `you` only. */
  readonly privateEvents: readonly PrivateEvent[];
  /** Pending decisions of `you`. */
  readonly requests: readonly OnlineRequest[];
  /** Seats (people only) still deciding the current phase. */
  readonly waitingOn: readonly PlayerId[];
  /** Seats a bot is playing for (§15.2); public. */
  readonly takeover: readonly PlayerId[];
  /** No person is connected, so nothing is decided or timed (§15.2). */
  readonly paused: boolean;
  readonly decisionSeconds: number;
  /** Timeouts in a row of `you`, so the table can warn before a takeover. */
  readonly timeouts: number;
  readonly startingCash: number;
  readonly result: MatchResult | null;
  readonly error: string | null;
}

/** Everything one connection needs to (re)draw the room from scratch. */
export interface RoomSnapshot {
  readonly phase: RoomPhase;
  readonly members: readonly RoomMemberInfo[];
  readonly joined: boolean;
  readonly isHost: boolean;
  readonly minSeats: number;
  readonly maxSeats: number;
  readonly match: OnlineMatch | null;
}

export type ClientMessage =
  | { readonly type: 'hello'; readonly token: string; readonly protocol: number }
  | { readonly type: 'join'; readonly name: string }
  /** `decisionSeconds` is one of DECISION_SECONDS_CHOICES; DEFAULT_DECISION_SECONDS when left out. */
  | { readonly type: 'start'; readonly seats: number; readonly decisionSeconds?: number }
  /** Takes the seat back from the bot (「取消託管」). */
  | { readonly type: 'resume' }
  /** The table now shows this decision: its clock may start. */
  | { readonly type: 'shown'; readonly requestId: number }
  /** Host only, after the match ended: back to the lobby with the same people. */
  | { readonly type: 'rematch' }
  /** Gives up a seat in the lobby; a running match keeps its seats. */
  | { readonly type: 'leave' }
  | { readonly type: 'submit'; readonly requestId: number; readonly action: Action };

export type ServerMessage =
  | { readonly type: 'sync'; readonly room: RoomSnapshot }
  | { readonly type: 'events'; readonly events: readonly MatchEvent[] }
  | { readonly type: 'private'; readonly event: PrivateEvent }
  | { readonly type: 'request'; readonly request: OnlineRequest }
  | { readonly type: 'waiting'; readonly players: readonly PlayerId[] }
  /** Who is under takeover changed, or the match paused or went on. */
  | { readonly type: 'seats'; readonly takeover: readonly PlayerId[]; readonly paused: boolean }
  /** To the seat only: the clock of one of its decisions started. */
  | { readonly type: 'clock'; readonly requestId: number; readonly timeLeftMs: number }
  /** To the seat only: its time ran out and the default was played; `takeover` once a bot took over. */
  | { readonly type: 'timed-out'; readonly phase: DecisionPhase; readonly takeover: boolean }
  | { readonly type: 'ended'; readonly result: MatchResult | null; readonly error: string | null }
  | { readonly type: 'error'; readonly code: ErrorCode; readonly message: string };

export type ErrorCode =
  | 'bad-message'
  | 'outdated'
  | 'no-room'
  | 'not-joined'
  | 'room-full'
  | 'already-started'
  | 'not-finished'
  | 'not-host'
  | 'bad-seats'
  | 'bad-time-limit'
  | 'bad-name'
  | 'stale-request'
  | 'illegal-action';

/** Tokens are client-made random ids (UUIDs); anything else is refused. */
const TOKEN_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

export function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

export function isRoomCode(code: unknown): code is string {
  return (
    typeof code === 'string' &&
    code.length === ROOM_CODE_LENGTH &&
    [...code].every((c) => ROOM_CODE_ALPHABET.includes(c))
  );
}

/** Trims a display name and drops control characters; null when nothing usable is left. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = [...raw.replace(/\p{Cc}/gu, '').trim()].slice(0, NAME_MAX_LENGTH).join('');
  return name.length > 0 ? name : null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Parses one raw client message. The action of a submit is only shape-checked here; the room
 * accepts it only if it equals one of the legal actions it offered.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  switch (data.type) {
    case 'hello':
      return isValidToken(data.token) && typeof data.protocol === 'number'
        ? { type: 'hello', token: data.token, protocol: data.protocol }
        : null;
    case 'join':
      return typeof data.name === 'string' ? { type: 'join', name: data.name } : null;
    case 'start':
      if (!Number.isInteger(data.seats)) return null;
      if (data.decisionSeconds === undefined) return { type: 'start', seats: data.seats as number };
      return Number.isInteger(data.decisionSeconds)
        ? { type: 'start', seats: data.seats as number, decisionSeconds: data.decisionSeconds as number }
        : null;
    case 'resume':
      return { type: 'resume' };
    case 'shown':
      return Number.isInteger(data.requestId) ? { type: 'shown', requestId: data.requestId as number } : null;
    case 'rematch':
      return { type: 'rematch' };
    case 'leave':
      return { type: 'leave' };
    case 'submit':
      return Number.isInteger(data.requestId) && isRecord(data.action) && typeof data.action.playerId === 'string'
        ? { type: 'submit', requestId: data.requestId as number, action: data.action as unknown as Action }
        : null;
    default:
      return null;
  }
}
