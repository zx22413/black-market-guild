import { useFrame } from '@react-three/fiber';
import { useRef, useSyncExternalStore } from 'react';
import { perfFlags, subscribePerfFlags } from '../../ui/scene/perfFlags';
import { WINDOW_MS, isPhone, judgeWindow, phoneDprLevels, startState, type DprState } from './dprPolicy';

/** Longest frame (ms) that counts: a longer gap is a hidden tab or a scene being loaded, not drawing speed. */
const IGNORE_OVER_MS = 250;

interface Phone {
  readonly levels: readonly number[];
  state: DprState;
}

/** The phone's adaptive state, shared by every table canvas (menu and match) so the level carries over. */
const phone: Phone | null = (() => {
  if (typeof window === 'undefined') return null;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (!isPhone(coarse, Math.min(window.innerWidth, window.innerHeight))) return null;
  const levels = phoneDprLevels(window.devicePixelRatio || 1);
  return { levels, state: startState(levels) };
})();

const listeners = new Set<() => void>();
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  const off = subscribePerfFlags(listener);
  return () => {
    listeners.delete(listener);
    off();
  };
};

/**
 * Pixel ratio for the table canvas: the perf panel's forced value if set, the phone's adaptive
 * level on a phone, otherwise react-three-fiber's usual range.
 */
export function useTableDpr(): number | [number, number] {
  const forced = useSyncExternalStore(subscribe, () => perfFlags.dprCap);
  const adaptive = useSyncExternalStore(subscribe, () => (phone ? phone.levels[phone.state.level]! : null));
  return forced ?? adaptive ?? [1, 2];
}

/** Inside the canvas: watches frame times and steps the phone's pixel ratio down (or back up). */
export function AdaptiveDpr() {
  if (!phone) return null;
  return <Watch phone={phone} />;
}

function Watch({ phone: p }: { readonly phone: Phone }) {
  const sample = useRef({ total: 0, count: 0, span: 0 });
  useFrame((_, delta) => {
    const ms = delta * 1000;
    if (ms > IGNORE_OVER_MS) return;
    const w = sample.current;
    w.total += ms;
    w.count += 1;
    w.span += ms;
    if (w.span < WINDOW_MS) return;
    const next = judgeWindow(p.state, w.total / w.count, p.levels);
    sample.current = { total: 0, count: 0, span: 0 };
    const changed = next.level !== p.state.level;
    p.state = next;
    if (changed) listeners.forEach((l) => l());
  });
  return null;
}
