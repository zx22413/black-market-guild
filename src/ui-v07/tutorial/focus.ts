import type { FocusTarget } from '../../v07/tutorial';

// Where each focus target is on screen: the elements marked `data-focus` on the table (an island
// is the set of invisible marks around it, see table3d/islandMarks.tsx).

export function focusSelector(target: FocusTarget): string {
  switch (target.kind) {
    case 'price':
      return `[data-focus="price-${target.good}"]`;
    case 'island':
      return `[data-focus="island-${target.player}"]`;
    case 'plate':
      return `[data-focus="plate-${target.player}"]`;
    default:
      return `[data-focus="${target.kind}"]`;
  }
}

export interface Hole {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * One lit rectangle around a target's boxes, padded and kept on screen; null when none of them
 * is on screen (the target is not showing right now).
 */
export function holeAround(boxes: readonly Box[], view: { readonly width: number; readonly height: number }, pad: number): Hole | null {
  const shown = boxes.filter((b) => b.right > b.left - 1 && b.bottom > b.top - 1 && b.right > 0 && b.bottom > 0 && b.left < view.width && b.top < view.height);
  if (shown.length === 0) return null;
  const left = Math.max(0, Math.min(...shown.map((b) => b.left)) - pad);
  const top = Math.max(0, Math.min(...shown.map((b) => b.top)) - pad);
  const right = Math.min(view.width, Math.max(...shown.map((b) => b.right)) + pad);
  const bottom = Math.min(view.height, Math.max(...shown.map((b) => b.bottom)) + pad);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Moves `from` part of the way to `to`, so the light glides when the target moves. */
export function easeHole(from: Hole | undefined, to: Hole, t: number): Hole {
  if (from === undefined) return to;
  const mix = (a: number, b: number) => a + (b - a) * t;
  return { x: mix(from.x, to.x), y: mix(from.y, to.y), width: mix(from.width, to.width), height: mix(from.height, to.height) };
}
