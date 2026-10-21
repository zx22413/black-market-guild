import { useEffect, useRef, useState } from 'react';
import type { FocusTarget } from '../../v07/tutorial';
import { currentGuide, easeHole, focusSelectors, holeAround, mergeHoles, type Hole } from './focus';

// The tutorial's spotlight: the screen goes dark except for what the host is talking about. It
// follows its targets every frame (islands move with the camera), never takes clicks, and shows
// nothing when none of the targets is on screen.

const PAD = 10;
const GLIDE = 0.3;
const SAME = 0.5;

const near = (a: Hole, b: Hole): boolean =>
  Math.abs(a.x - b.x) < SAME && Math.abs(a.y - b.y) < SAME && Math.abs(a.width - b.width) < SAME && Math.abs(a.height - b.height) < SAME;

/** The elements a target lights: those of its first selector that has any on screen. */
function elementsOf(target: FocusTarget): HTMLElement[] {
  const view = { width: window.innerWidth, height: window.innerHeight };
  for (const selector of focusSelectors(target)) {
    const shown = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => holeAround([el.getBoundingClientRect()], view, 0) !== null);
    if (shown.length > 0) return shown;
  }
  return [];
}

/** A question the table asks before going on (「還沒做完」): answering it comes before anything else. */
const DIALOG: FocusTarget = { kind: 'dialog' };

/**
 * An open dialog first; with a guide, the targets of its first group not done yet; else the
 * step's own targets.
 */
function lit(targets: readonly FocusTarget[], guide: readonly (readonly FocusTarget[])[] | null): readonly FocusTarget[] {
  if (elementsOf(DIALOG).length > 0) return [DIALOG];
  if (guide === null) return targets;
  const at = currentGuide(guide, elementsOf, (el) => ({ done: el.dataset.done, loaded: el.dataset.loaded }));
  return at === -1 ? [] : guide[at]!;
}

function measure(targets: readonly FocusTarget[]): Hole[] {
  const view = { width: window.innerWidth, height: window.innerHeight };
  // Holes that touch become one, so a ring never runs across what the other one lights.
  return mergeHoles(
    targets.flatMap((t) => {
      for (const selector of focusSelectors(t)) {
        const boxes = [...document.querySelectorAll(selector)].map((el) => el.getBoundingClientRect());
        const hole = holeAround(boxes, view, PAD);
        if (hole) return [hole];
      }
      return [];
    }),
  );
}

/** `pulse`: the lit part is what to press now (「提交」), so its ring breathes. */
export function FocusMask({
  targets,
  guide = null,
  pulse = false,
  solid = false,
  onHoles,
}: {
  readonly targets: readonly FocusTarget[];
  /** While you carry out a step: what to click, in order (see coachView); lights the first not done. */
  readonly guide?: readonly (readonly FocusTarget[])[] | null;
  readonly pulse?: boolean;
  /** Black out the whole table (a picture is up in the middle), lighting nothing. */
  readonly solid?: boolean;
  /** Told where the lit rectangles are whenever they move (the host's card keeps clear of them). */
  readonly onHoles?: (holes: readonly Hole[]) => void;
}) {
  const [holes, setHoles] = useState<readonly Hole[]>([]);
  const shown = useRef<readonly Hole[]>([]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const goal = measure(lit(targets, guide));
      const next = goal.length === shown.current.length ? goal.map((h, i) => easeHole(shown.current[i], h, GLIDE)) : goal;
      if (next.length !== shown.current.length || next.some((h, i) => !near(h, shown.current[i]!))) {
        shown.current = next;
        setHoles(next);
        onHoles?.(goal);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [targets, guide, onHoles]);

  if (solid) return <svg className="focus-mask" aria-hidden="true"><rect className="focus-black" width="100%" height="100%" /></svg>;
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
