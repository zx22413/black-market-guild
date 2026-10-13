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
