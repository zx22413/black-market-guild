import { useEffect, useState, type RefObject } from 'react';
import type { SafeArea } from '../../ui/scene/CameraRig';

// The camera's safe area measured from the HUD actually on screen (market strip at the top, role
// hand and bar at the bottom), so islands and plates are never framed under them, whatever the
// window size or how tall the hand is.

const GAP = 12;
const SIDE = 24;
/**
 * The camera keeps at least this share of the window height to frame the table in. When the HUD
 * leaves less (a tall hand plus a long description on a short phone), the HUD may overlap the sea's
 * outskirts instead: shrinking the safe area further would back the camera off until the islands
 * are specks that cannot be tapped.
 */
const MIN_FREE_SHARE = 0.3;

function measure(top: readonly RefObject<HTMLElement | null>[], bottom: readonly RefObject<HTMLElement | null>[]): SafeArea {
  const h = window.innerHeight;
  const tops = top.flatMap((r) => (r.current ? [r.current.getBoundingClientRect().bottom] : []));
  const bottoms = bottom.flatMap((r) => (r.current ? [r.current.getBoundingClientRect().top] : []));
  const above = Math.max(GAP, ...tops.map((y) => y + GAP));
  const below = Math.max(GAP, ...bottoms.map((y) => h - y + GAP));
  document.documentElement.style.setProperty('--hud-top', `${Math.round(above - GAP)}px`);
  document.documentElement.style.setProperty('--hud-bottom', `${Math.round(below - GAP)}px`);
  const overflow = above + below - h * (1 - MIN_FREE_SHARE);
  // Give the overflow back in proportion to what each side holds (but never below the gap).
  const give = overflow > 0 ? overflow / (above + below) : 0;
  return {
    top: Math.max(GAP, Math.round(above * (1 - give))),
    bottom: Math.max(GAP, Math.round(below * (1 - give))),
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
