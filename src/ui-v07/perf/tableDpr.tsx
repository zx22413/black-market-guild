import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { perfFlags, subscribePerfFlags } from '../../ui/scene/perfFlags';
import { PHONE_FRAME_MS, UNCAPPED_FRAME_MS, WINDOW_MS, isPhone, judgeWindow, phoneDprLevels, startState, type DprState } from './dprPolicy';

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

/** Whether this device is a phone, whose table draws at a capped frame rate (see FrameLimiter). */
export const framesCapped = phone !== null;

/** The frame time (ms) the table is aiming at now: the phone's cap, or full speed on a desktop or when the panel lifts the cap. */
const targetFrameMs = (): number => (phone && !perfFlags.uncapped ? PHONE_FRAME_MS : UNCAPPED_FRAME_MS);

const listeners = new Set<() => void>();
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  const off = subscribePerfFlags(listener);
  return () => {
    listeners.delete(listener);
    off();
  };
};

/** The ratio now wanted: the panel's forced value, else the phone's adaptive level, else react-three-fiber's usual range. */
const wanted = (): number | [number, number] => perfFlags.dprCap ?? (phone ? phone.levels[phone.state.level]! : [1, 2]);

/**
 * Pixel ratio for the table canvas: the perf panel's forced value if set, the phone's adaptive
 * level on a phone, otherwise react-three-fiber's usual range.
 */
export function useTableDpr(): number | [number, number] {
  const forced = useSyncExternalStore(subscribe, () => perfFlags.dprCap);
  const adaptive = useSyncExternalStore(subscribe, () => (phone ? phone.levels[phone.state.level]! : null));
  return forced ?? adaptive ?? [1, 2];
}

/**
 * Inside the canvas: applies a changed pixel ratio at once, and on a phone watches frame times to
 * step it down (or back up).
 *
 * Resizing the canvas clears it. If that happens through the `dpr` prop, React does it after the
 * frame was drawn but before it is shown, and the player sees one black frame (the table's labels
 * stay, the sea and islands vanish). Done here, from inside `useFrame` (which runs before the
 * frame is drawn), the same frame is drawn at the new size and nothing blank is ever shown.
 */
export function AdaptiveDpr() {
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => subscribe(() => setDpr(wanted())), [setDpr]);
  return phone ? <Watch phone={phone} /> : null;
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
    const next = judgeWindow(p.state, w.total / w.count, p.levels, targetFrameMs());
    sample.current = { total: 0, count: 0, span: 0 };
    const changed = next.level !== p.state.level;
    p.state = next;
    if (changed) listeners.forEach((l) => l());
  });
  return null;
}

/**
 * Inside a canvas whose `frameloop` is "never" (only on a phone, see `framesCapped`): draws a frame
 * on the display's own timing but no more often than the phone's cap, so the GPU idles between
 * frames. The 10% slack lets a 60Hz screen deliver every second tick as 33ms despite timer jitter.
 */
export function FrameLimiter() {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    let raf = 0;
    let last = -Infinity;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < (perfFlags.uncapped ? 0 : PHONE_FRAME_MS * 0.9)) return;
      last = now;
      advance(now);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [advance]);
  return null;
}
