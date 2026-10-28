// "Is anyone in an online match right now?" for the /stats dashboard, so a deploy (which ends
// running matches, docs/online/backlog.md §1) can wait. Estimated from the statistics: an online
// match counts while it has started, has not ended or been left, and its player sent something
// lately. People who turned statistics off are not seen, so it is a hint, not a guarantee.

/** Online matches started longer ago than this are not looked at (a match is ~10–30 minutes). */
export const LIVE_LOOKBACK_MS = 3 * 60 * 60 * 1000;
/** A player who sent nothing for this long has probably gone (events arrive every 30 seconds). */
export const LIVE_QUIET_MS = 15 * 60 * 1000;

/** One player's latest online match that has no end yet. */
export interface OpenMatchRow {
  readonly client: string;
  readonly started: number;
  /** Their latest event since the match started. */
  readonly last: number;
  /** The last round they finished, if any. */
  readonly round: number | null;
}

export interface LiveMatch {
  readonly startedMinutesAgo: number;
  readonly lastMinutesAgo: number;
  readonly round: number | null;
}

export interface LiveReport {
  /** Probably playing now. */
  readonly active: readonly LiveMatch[];
  /** Started and never ended, but silent for a while (closed the page, lost the connection). */
  readonly quiet: readonly LiveMatch[];
}

const minutes = (ms: number): number => Math.max(0, Math.floor(ms / 60_000));

export function liveReport(rows: readonly OpenMatchRow[], now: number): LiveReport {
  const recent = rows.filter((r) => now - r.started <= LIVE_LOOKBACK_MS);
  const toMatch = (r: OpenMatchRow): LiveMatch => ({ startedMinutesAgo: minutes(now - r.started), lastMinutesAgo: minutes(now - r.last), round: r.round });
  const byLast = (a: OpenMatchRow, b: OpenMatchRow) => b.last - a.last;
  return {
    active: recent.filter((r) => now - r.last <= LIVE_QUIET_MS).sort(byLast).map(toMatch),
    quiet: recent.filter((r) => now - r.last > LIVE_QUIET_MS).sort(byLast).map(toMatch),
  };
}
