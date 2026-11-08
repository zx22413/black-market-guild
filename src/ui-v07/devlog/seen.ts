// Which dev-log version this browser has already opened, so the menu button can show a 「新」 dot
// for a newer one. A per-viewer convenience like tutorial/welcome.ts: with storage missing or
// blocked the dot simply shows again after a reload.

const KEY = 'bmg.v07.devlogSeen';

let seenThisPage: string | null = null;

/** Whether `latest` has not been opened yet in this browser. */
export function hasUnseenDevLog(latest: string): boolean {
  if (!latest || seenThisPage === latest) return false;
  try {
    return globalThis.localStorage?.getItem(KEY) !== latest;
  } catch {
    return true;
  }
}

export function markDevLogSeen(latest: string): void {
  seenThisPage = latest;
  try {
    globalThis.localStorage?.setItem(KEY, latest);
  } catch {
    // Storage unavailable: the dot stays away until the page is reloaded.
  }
}

/** Test hook: forget this page's memory. */
export function resetDevLogSeenForTest(): void {
  seenThisPage = null;
}
