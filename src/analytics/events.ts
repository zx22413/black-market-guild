// The anonymous play statistics (docs/online/public-launch-plan.md §4.2): every event name and
// the fields it may carry. The browser sends only these; the server writes only what passes
// `checkBatch`. Pure, shared by both sides.

type Field =
  | { readonly kind: 'enum'; readonly values: readonly string[] }
  | { readonly kind: 'int'; readonly min: number; readonly max: number }
  | { readonly kind: 'bool' }
  | { readonly kind: 'text'; readonly max: number }
  /** Small named counts, such as how often each role was played. */
  | { readonly kind: 'counts'; readonly keys: readonly string[]; readonly max: number };

const MODES = ['local', 'hotseat', 'online'] as const;
const mode: Field = { kind: 'enum', values: MODES };
const text = (max: number): Field => ({ kind: 'text', max });
const int = (min: number, max: number): Field => ({ kind: 'int', min, max });
const bool: Field = { kind: 'bool' };
const ROLES = ['guard', 'pirate', 'intel', 'smuggler', 'broker'];

export const EVENTS = {
  visit: { device: { kind: 'enum', values: ['phone', 'desktop'] }, first: bool, days: int(0, 100_000), from: text(80) },
  menu_pick: { pick: text(30) },
  tutorial_start: { lesson: text(30) },
  tutorial_done: { lesson: text(30), seconds: int(0, 86_400) },
  tutorial_quit: { lesson: text(30), step: int(0, 1000) },
  match_start: { mode, seats: int(2, 4), nth: int(1, 1_000_000) },
  round_end: { mode, round: int(1, 50), cash: int(-10_000_000, 100_000_000), rank: int(1, 4) },
  match_end: {
    mode,
    rank: int(1, 4),
    wealth: int(-10_000_000, 100_000_000),
    seconds: int(0, 86_400),
    island: text(30),
    roles: { kind: 'counts', keys: ROLES, max: 50 },
  },
  match_quit: { mode, round: int(0, 50), phase: text(30) },
  rules_open: { chapter: text(20), where: { kind: 'enum', values: ['menu', 'table'] } },
  room_create: {},
  invite_copy: {},
  room_join: { role: { kind: 'enum', values: ['host', 'guest'] }, link: bool, room: text(8) },
  online_end: { room: text(8), humans: int(1, 4), timeouts: int(0, 1000), takeover: bool },
  feedback: { like: bool, text: text(200), mode },
  client_error: { message: text(200), screen: text(30) },
  table_ready: { mode, ms: int(0, 600_000) },
} as const satisfies Readonly<Record<string, Readonly<Record<string, Field>>>>;

export type EventName = keyof typeof EVENTS;
export type EventValue = string | number | boolean | Readonly<Record<string, number>>;
export type EventData = Readonly<Record<string, EventValue>>;

export interface AnalyticsEvent {
  readonly name: EventName;
  /** Milliseconds since the epoch, on the sender's clock. */
  readonly at: number;
  readonly data: EventData;
}

/** Most events one request may carry; the browser sends every 30 seconds, so far fewer arrive. */
export const MAX_BATCH = 50;
const CLIENT_ID = /^[A-Za-z0-9-]{8,64}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const isEventName = (name: unknown): name is EventName => typeof name === 'string' && Object.hasOwn(EVENTS, name);

function checkValue(field: Field, value: unknown): EventValue | undefined {
  switch (field.kind) {
    case 'enum':
      return typeof value === 'string' && field.values.includes(value) ? value : undefined;
    case 'int':
      return Number.isInteger(value) && (value as number) >= field.min && (value as number) <= field.max ? (value as number) : undefined;
    case 'bool':
      return typeof value === 'boolean' ? value : undefined;
    case 'text':
      return typeof value === 'string' ? [...value.replace(/\p{Cc}/gu, ' ')].slice(0, field.max).join('') : undefined;
    case 'counts': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
      const entries = Object.entries(value as Record<string, unknown>).filter(
        ([key, n]) => field.keys.includes(key) && Number.isInteger(n) && (n as number) >= 0 && (n as number) <= field.max,
      );
      return Object.fromEntries(entries) as Record<string, number>;
    }
  }
}

/** The event's known fields that are valid; unknown or invalid fields are dropped, not the event. */
export function checkData(name: EventName, data: unknown): EventData {
  const fields: Readonly<Record<string, Field>> = EVENTS[name];
  const raw = typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const kept: Record<string, EventValue> = {};
  for (const [key, field] of Object.entries(fields)) {
    const value = checkValue(field, raw[key]);
    if (value !== undefined) kept[key] = value;
  }
  return kept;
}

/**
 * A request body as the server writes it: the client id and the events with a known name,
 * their fields checked, and their time kept only when within a day of `now`. Null when the body
 * is not a batch at all.
 */
export function checkBatch(body: unknown, now: number): { readonly client: string; readonly events: readonly AnalyticsEvent[] } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { client, events } = body as Record<string, unknown>;
  if (typeof client !== 'string' || !CLIENT_ID.test(client) || !Array.isArray(events)) return null;
  const checked = events.slice(0, MAX_BATCH).flatMap((event: unknown): AnalyticsEvent[] => {
    if (typeof event !== 'object' || event === null) return [];
    const { name, at, data } = event as Record<string, unknown>;
    if (!isEventName(name)) return [];
    const time = typeof at === 'number' && Math.abs(at - now) <= DAY_MS ? Math.round(at) : now;
    return [{ name, at: time, data: checkData(name, data) }];
  });
  return { client, events: checked };
}

/** The day in Taiwan time (UTC+8), for daily charts. */
export function taipeiDay(ms: number): string {
  return new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
