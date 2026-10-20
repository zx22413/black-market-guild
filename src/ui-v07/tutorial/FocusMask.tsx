import { useEffect, useRef, useState } from 'react';
import type { FocusTarget } from '../../v07/tutorial';
import { easeHole, focusSelector, holeAround, mergeHoles, type Hole } from './focus';

// The tutorial's spotlight: the screen goes dark except for what the host is talking about. It
// follows its targets every frame (islands move with the camera), never takes clicks, and shows
// nothing when none of the targets is on screen.

const PAD = 10;
const GLIDE = 0.3;
const SAME = 0.5;

const near = (a: Hole, b: Hole): boolean =>
  Math.abs(a.x - b.x) < SAME && Math.abs(a.y - b.y) < SAME && Math.abs(a.width - b.width) < SAME && Math.abs(a.height - b.height) < SAME;

function measure(targets: readonly FocusTarget[]): Hole[] {
  const view = { width: window.innerWidth, height: window.innerHeight };
  // Holes that touch become one, so a ring never runs across what the other one lights.
  return mergeHoles(
    targets.flatMap((t) => {
      const boxes = [...document.querySelectorAll(focusSelector(t))].map((el) => el.getBoundingClientRect());
      const hole = holeAround(boxes, view, PAD);
      return hole ? [hole] : [];
    }),
  );
}

/** `pulse`: the lit part is what to press now (「提交」), so its ring breathes. */
export function FocusMask({ targets, pulse = false }: { readonly targets: readonly FocusTarget[]; readonly pulse?: boolean }) {
  const [holes, setHoles] = useState<readonly Hole[]>([]);
  const shown = useRef<readonly Hole[]>([]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const goal = measure(targets);
      const next = goal.length === shown.current.length ? goal.map((h, i) => easeHole(shown.current[i], h, GLIDE)) : goal;
      if (next.length !== shown.current.length || next.some((h, i) => !near(h, shown.current[i]!))) {
        shown.current = next;
        setHoles(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [targets]);

  if (holes.length === 0) return null;
  return (
    <svg className={`focus-mask ${pulse ? 'pulse' : ''}`} aria-hidden="true">
      <defs>
        <mask id="focus-holes">
          <rect width="100%" height="100%" fill="white" />
          {holes.map((h, i) => (
            <rect key={i} x={h.x} y={h.y} width={h.width} height={h.height} rx={12} fill="black" />
          ))}
        </mask>
      </defs>
      <rect className="focus-dark" width="100%" height="100%" mask="url(#focus-holes)" />
      {holes.map((h, i) => (
        <rect key={i} className="focus-ring" x={h.x} y={h.y} width={h.width} height={h.height} rx={12} />
      ))}
    </svg>
  );
}
