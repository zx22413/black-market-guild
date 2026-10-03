import type { DecisionContext } from '../bots';
import type { Action, MatchEvent, MatchResult, PlayerId, PrivateEvent } from '../game';

/** Bumped whenever messages change shape; a stale tab is told to reload. */
export const PROTOCOL_VERSION = 1;

/** Largest client message the server reads; actions are small JSON objects. */
export const MAX_MESSAGE_BYTES = 16_384;

export const NAME_MAX_LENGTH = 12;

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
  | { readonly type: 'start'; readonly seats: number }
  | { readonly type: 'submit'; readonly requestId: number; readonly action: Action };

export type ServerMessage =
  | { readonly type: 'sync'; readonly room: RoomSnapshot }
  | { readonly type: 'events'; readonly events: readonly MatchEvent[] }
  | { readonly type: 'private'; readonly event: PrivateEvent }
  | { readonly type: 'request'; readonly request: OnlineRequest }
  | { readonly type: 'ended'; readonly result: MatchResult | null; readonly error: string | null }
  | { readonly type: 'error'; readonly code: ErrorCode; readonly message: string };

export type ErrorCode =
  | 'bad-message'
  | 'outdated'
  | 'no-room'
  | 'not-joined'
  | 'room-full'
  | 'already-started'
  | 'not-host'
  | 'bad-seats'
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
      return Number.isInteger(data.seats) ? { type: 'start', seats: data.seats as number } : null;
    case 'submit':
      return Number.isInteger(data.requestId) && isRecord(data.action) && typeof data.action.playerId === 'string'
        ? { type: 'submit', requestId: data.requestId as number, action: data.action as unknown as Action }
        : null;
    default:
      return null;
  }
}
