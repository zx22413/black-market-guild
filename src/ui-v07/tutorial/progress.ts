import type { TutorialId } from '../../v07/tutorial';

// Which lessons this browser has finished (docs/tutorial-outline.md §1): only "done or not", never
// a half-played lesson. A per-viewer convenience like the reminders in table/reminderSettings.ts;
// with storage missing or blocked, nothing is remembered.

const PREFIX = 'bmg.v07.tutorialDone.';

export function isLessonDone(id: TutorialId): boolean {
  try {
    return globalThis.localStorage?.getItem(PREFIX + id) === '1';
  } catch {
    return false;
  }
}

export function markLessonDone(id: TutorialId): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + id, '1');
  } catch {
    // Storage unavailable: the check mark only lasts for this page.
  }
}
