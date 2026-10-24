// The sound on/off switch. A per-viewer convenience, so it lives in this browser's storage; when
// storage is missing or blocked (private windows) the choice only lasts for this page.

const KEY = 'bmg.v07.muted';

let pageMuted: boolean | null = null;
const listeners = new Set<() => void>();

function stored(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return pageMuted ?? stored();
}

export function setMuted(muted: boolean): void {
  pageMuted = muted;
  try {
    if (muted) globalThis.localStorage?.setItem(KEY, '1');
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Storage unavailable: the choice only lasts for this page.
  }
  for (const listener of [...listeners]) listener();
}

/** Calls `listener` after every change; returns the unsubscribe (shaped for `useSyncExternalStore`). */
export function subscribeMuted(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
