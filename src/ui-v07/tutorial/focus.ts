import type { FocusTarget } from '../../v07/tutorial';

// Where each focus target is on screen: the elements marked `data-focus` on the table (an island
// is the set of invisible marks around it, see table3d/islandMarks.tsx).

/**
 * The elements to light, best first: a target with a fallback (a building's card, or while the
 * list is closed the button that opens it) lights the first one on screen.
 */
export function focusSelectors(target: FocusTarget): readonly string[] {
  return target.kind === 'build' ? [`[data-focus="build-${target.building}"]`, '[data-focus="build-open"]'] : [focusSelector(target)];
}

export function focusSelector(target: FocusTarget): string {
  switch (target.kind) {
    case 'build':
      return `[data-focus="build-${target.building}"]`;
    case 'role':
      return `[data-role-card="${target.role}"]`;
    case 'target':
      return `[data-target="${target.player}"]`;
    case 'bet':
      return `[data-bet="${target.good}${target.direction === 1 ? '+' : '-'}"]`;
    case 'crate':
      return `[data-crate="${target.good}"]`;
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

const overlaps = (a: Hole, b: Hole): boolean => a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

const union = (a: Hole, b: Hole): Hole => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};

/** Joins holes that overlap or touch (a joined hole may now reach another, so it repeats). */
export function mergeHoles(holes: readonly Hole[]): Hole[] {
  const merged: Hole[] = [];
  for (const hole of holes) {
    let current = hole;
    for (let i = merged.length - 1; i >= 0; i -= 1) {
      if (overlaps(merged[i]!, current)) {
        current = union(merged[i]!, current);
        merged.splice(i, 1);
      }
    }
    merged.push(current);
  }
  return merged.length === holes.length ? merged : mergeHoles(merged);
}

export interface Spot {
  readonly left: number;
  readonly top: number;
}

const overlapArea = (a: Hole, b: Hole): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/**
 * Where the host's card goes so it covers as little of what is lit as possible: the first of the
 * four corners (top left first, under the menu bar) that covers nothing, else the one covering least.
 */
export function placeCard(holes: readonly Hole[], view: { readonly width: number; readonly height: number }, card: { readonly width: number; readonly height: number }, margin: { readonly side: number; readonly top: number; readonly bottom: number }): Spot {
  const right = Math.max(margin.side, view.width - margin.side - card.width);
  const bottom = Math.max(margin.top, view.height - margin.bottom - card.height);
  const spots: Spot[] = [
    { left: margin.side, top: margin.top },
    { left: right, top: margin.top },
    { left: margin.side, top: bottom },
    { left: right, top: bottom },
  ];
  const covered = (s: Spot) => holes.reduce((n, h) => n + overlapArea({ x: s.left, y: s.top, width: card.width, height: card.height }, h), 0);
  return spots.find((s) => covered(s) === 0) ?? spots.reduce((best, s) => (covered(s) < covered(best) ? s : best));
}

/** The marks an element carries for the guide: `data-done`, and a warehouse stack's `data-loaded`. */
export interface GuideMarks {
  readonly done?: string | undefined;
  readonly loaded?: string | undefined;
}

/** Has this target been carried out (a card picked, a ship chosen, enough crates loaded)? */
export function isDone(target: FocusTarget, marks: GuideMarks): boolean {
  if (target.kind === 'crate') return Number(marks.loaded ?? 0) >= target.count;
  return marks.done === 'true';
}

/**
 * Which guide group to light: the first one that is on screen and not done yet. A group no part
 * of which is on screen is skipped (a stack with nothing left to load, a card that is gone).
 */
export function currentGuide<T>(
  groups: readonly (readonly FocusTarget[])[],
  find: (target: FocusTarget) => readonly T[],
  marksOf: (element: T) => GuideMarks,
): number {
  return groups.findIndex((group) => {
    const found = group.map((t) => ({ t, elements: find(t) }));
    if (found.every((f) => f.elements.length === 0)) return false;
    return !found.some((f) => f.elements.some((el) => isDone(f.t, marksOf(el))));
  });
}
