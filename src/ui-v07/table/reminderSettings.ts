// "Don't remind me again" for gentle confirmations. A per-viewer convenience, so it lives in this
// browser's storage; storage can be missing or blocked (private windows), in which case the
// reminder simply shows every time.

const PREFIX = 'bmg.v07.skipReminder.';

export type ReminderId = 'invest-unfinished' | 'deploy-unfinished';

export function isReminderSkipped(id: ReminderId): boolean {
  try {
    return globalThis.localStorage?.getItem(PREFIX + id) === '1';
  } catch {
    return false;
  }
}

export function setReminderSkipped(id: ReminderId, skip: boolean): void {
  try {
    if (skip) globalThis.localStorage?.setItem(PREFIX + id, '1');
    else globalThis.localStorage?.removeItem(PREFIX + id);
  } catch {
    // Storage unavailable: the choice only lasts for this page.
  }
}

// "Shown once" how-to hints (点貨箱裝上船 and the like): gone for good after the first time the
// player does the thing. Same storage rules as the reminders above.

const HINT_PREFIX = 'bmg.v07.hintSeen.';

export type HintId = 'load-cargo' | 'unload-cargo';

export function isHintSeen(id: HintId): boolean {
  try {
    return globalThis.localStorage?.getItem(HINT_PREFIX + id) === '1';
  } catch {
    return false;
  }
}

export function markHintSeen(id: HintId): void {
  try {
    globalThis.localStorage?.setItem(HINT_PREFIX + id, '1');
  } catch {
    // Storage unavailable: the hint comes back next time.
  }
}
