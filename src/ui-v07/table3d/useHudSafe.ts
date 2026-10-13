import { useEffect, useState, type RefObject } from 'react';
import type { SafeArea } from '../../ui/scene/CameraRig';

// The camera's safe area measured from the HUD actually on screen (market strip at the top, role
// hand and bar at the bottom), so islands and plates are never framed under them, whatever the
// window size or how tall the hand is.

const GAP = 12;
const SIDE = 24;

function measure(top: readonly RefObject<HTMLElement | null>[], bottom: readonly RefObject<HTMLElement | null>[]): SafeArea {
  const h = window.innerHeight;
  const tops = top.flatMap((r) => (r.current ? [r.current.getBoundingClientRect().bottom] : []));
  const bottoms = bottom.flatMap((r) => (r.current ? [r.current.getBoundingClientRect().top] : []));
  return {
    top: Math.max(GAP, ...tops.map((y) => y + GAP)),
    bottom: Math.max(GAP, ...bottoms.map((y) => h - y + GAP)),
    left: SIDE,
    right: SIDE,
  };
}

const same = (a: SafeArea, b: SafeArea) => a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right;

export function useHudSafe(top: readonly RefObject<HTMLElement | null>[], bottom: readonly RefObject<HTMLElement | null>[], fallback: SafeArea): SafeArea {
  const [safe, setSafe] = useState(fallback);
  useEffect(() => {
    const update = () => {
      const next = measure(top, bottom);
      setSafe((prev) => (same(prev, next) ? prev : next));
    };
    update();
    const observer = new ResizeObserver(update);
    for (const r of [...top, ...bottom]) if (r.current) observer.observe(r.current);
    window.addEventListener('resize', update);
    // HUD pieces come and go between steps; re-measure a few times a second, cheaply.
    const timer = setInterval(update, 300);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      clearInterval(timer);
    };
  }, [top, bottom]);
  return safe;
}
