// Whether this browser has been asked 「第一次遊玩？」 yet: the main menu offers the tutorial once to
// someone who has never seen it, and either answer ends the question. A per-viewer convenience like
// tutorial/progress.ts; with storage missing or blocked it is asked once per page load.

const KEY = 'bmg.v07.welcomed';

let askedThisPage = false;

export function shouldAskTutorial(lessonDone: boolean): boolean {
  if (askedThisPage || lessonDone) return false;
  try {
    return globalThis.localStorage?.getItem(KEY) !== '1';
  } catch {
    return true;
  }
}

export function markTutorialAsked(): void {
  askedThisPage = true;
  try {
    globalThis.localStorage?.setItem(KEY, '1');
  } catch {
    // Storage unavailable: not asked again until the page is reloaded.
  }
}
