import { useEffect, useRef, useState } from 'react';

// Online rooms only (docs/game-design.md §15.1): a round's resolution waits for two presses, 「開始航程」
// and the bill's 「點任意處繼續」. The server has already moved on to the next decisions, so
// someone who walks away there would keep the whole table waiting; after a while they go on by themselves.

/** Seconds a resolution waits for its press in an online room before going on by itself. */
export const RESOLUTION_AUTO_SECONDS = 20;

/** 「開始航程」 → 「開始航程（12）」 while a countdown runs. */
export function countdownLabel(label: string, secondsLeft: number | null): string {
  return secondsLeft === null ? label : `${label}（${secondsLeft}）`;
}

/**
 * Counts down from `seconds` while `key` is not null and calls `action` once at zero; a new key
 * starts over. Returns the whole seconds left, or null when idle.
 */
export function useAutoAdvance(key: string | null, seconds: number, action: () => void): number | null {
  const [left, setLeft] = useState<number | null>(null);
  const actionRef = useRef(action);
  actionRef.current = action;
  useEffect(() => {
    if (key === null) {
      setLeft(null);
      return undefined;
    }
    const deadline = Date.now() + seconds * 1000;
    setLeft(seconds);
    const timer = setInterval(() => {
      const ms = deadline - Date.now();
      if (ms <= 0) {
        clearInterval(timer);
        actionRef.current();
        return;
      }
      setLeft(Math.ceil(ms / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, [key, seconds]);
  return key === null ? null : left;
}
