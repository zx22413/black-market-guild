// Abuse limits for the public rooms (docs/online/public-launch-plan.md §5). Operational numbers,
// not game rules: change them freely as real traffic shows. Pure, so tests need no Workers runtime.

export interface WindowRule {
  readonly limit: number;
  readonly windowMs: number;
}

/** Rooms one IP address may open. */
export const CREATE_RULE: WindowRule = { limit: 5, windowMs: 10 * 60 * 1000 };
/** WebSocket connections one IP address may open (room code guessing, connection floods). */
export const CONNECT_RULE: WindowRule = { limit: 30, windowMs: 60 * 1000 };
/** Messages one connection may send; past it the connection is closed. */
export const MESSAGE_RULE: WindowRule = { limit: 50, windowMs: 10 * 1000 };
/** Statistics batches one IP address may send (the game sends one every 30 seconds at most). */
export const EVENTS_RULE: WindowRule = { limit: 20, windowMs: 60 * 1000 };
/** Connections one room holds at once: four seats with room for reloads and second tabs. */
export const MAX_ROOM_SOCKETS = 8;

/**
 * Sliding window: whether one more hit fits, and the hits to keep (only those still inside the
 * window, plus this one when it fits).
 */
export function hit(times: readonly number[], now: number, rule: WindowRule): { readonly allowed: boolean; readonly times: readonly number[] } {
  const recent = times.filter((t) => t > now - rule.windowMs);
  if (recent.length >= rule.limit) return { allowed: false, times: recent };
  return { allowed: true, times: [...recent, now] };
}

/**
 * WebSockets may only come from the game's own pages: the same host, or a local development
 * server. A missing Origin (not a browser) passes; this only keeps other websites out.
 */
export function originAllowed(origin: string | null, requestUrl: string): boolean {
  if (origin === null) return true;
  let from: URL;
  try {
    from = new URL(origin);
  } catch {
    return false;
  }
  const to = new URL(requestUrl);
  return from.host === to.host || ['localhost', '127.0.0.1'].includes(from.hostname);
}
