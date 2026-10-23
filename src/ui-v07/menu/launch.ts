import { useEffect, useState } from 'react';
import { LAUNCH } from './menuShots';

// The launch between the menu and a match: the menu table sends every ship out for LAUNCH.sail
// seconds before the match screen takes over. Skipped with reduced motion.

export const prefersStill = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How long the launch holds the match screen back, in ms (0 with reduced motion). */
export const launchMs = (): number => (prefersStill() ? 0 : LAUNCH.sail * 1000);

/**
 * True for the launch's length after a room's phase goes from the lobby to playing while this
 * screen watches; never when the screen opens on a match already under way (a rejoin). Decided
 * while rendering, so the menu table is never dropped for a frame before the launch.
 */
export function useLaunchOnStart(phase: string | null): boolean {
  const [previous, setPrevious] = useState(phase);
  const [until, setUntil] = useState(0);
  if (phase !== previous) {
    setPrevious(phase);
    const ms = launchMs();
    if (previous === 'lobby' && phase === 'playing' && ms > 0) setUntil(performance.now() + ms);
  }
  useEffect(() => {
    if (until === 0) return;
    const timer = setTimeout(() => setUntil(0), Math.max(0, until - performance.now()));
    return () => clearTimeout(timer);
  }, [until]);
  return until > 0;
}
