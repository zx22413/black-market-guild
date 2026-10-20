import { describe, expect, it } from 'vitest';
import { currentGuide, easeHole, focusSelector, focusSelectors, holeAround, isDone, mergeHoles, placeCard } from '../../src/ui-v07/tutorial/focus';
import type { FocusTarget } from '../../src/v07/tutorial';
import { islandMarkPoints } from '../../src/ui-v07/table3d/islandMarks';

const VIEW = { width: 800, height: 600 };
const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });

describe('tutorial focus', () => {
  it('names each target by its data-focus mark', () => {
    expect(focusSelector({ kind: 'market' })).toBe('[data-focus="market"]');
    expect(focusSelector({ kind: 'price', good: 'wood' })).toBe('[data-focus="price-wood"]');
    expect(focusSelector({ kind: 'island', player: 'p2' })).toBe('[data-focus="island-p2"]');
    expect(focusSelector({ kind: 'plate', player: 'p1' })).toBe('[data-focus="plate-p1"]');
    expect(focusSelector({ kind: 'advance' })).toBe('[data-focus="advance"]');
    expect(focusSelector({ kind: 'event' })).toBe('[data-focus="event"]');
    // A building: its card in the open list first, else the button that opens the list.
    expect(focusSelectors({ kind: 'build', building: 'shipyard' })).toEqual(['[data-focus="build-shipyard"]', '[data-focus="build-open"]']);
    expect(focusSelectors({ kind: 'rank' })).toEqual(['[data-focus="rank"]']);
  });

  it('lights one padded rectangle around all of a target\'s boxes, kept on screen', () => {
    expect(holeAround([box(100, 100, 120, 110), box(200, 150, 210, 160)], VIEW, 10)).toEqual({ x: 90, y: 90, width: 130, height: 80 });
    expect(holeAround([box(-50, 590, 30, 620)], VIEW, 10)).toEqual({ x: 0, y: 580, width: 40, height: 20 });
  });

  it('lights nothing for a target that is not on screen', () => {
    expect(holeAround([], VIEW, 10)).toBeNull();
    expect(holeAround([box(900, 700, 950, 720)], VIEW, 10)).toBeNull();
  });

  it('glides toward a moved target and jumps to a new one', () => {
    const to = { x: 100, y: 100, width: 50, height: 50 };
    expect(easeHole(undefined, to, 0.3)).toBe(to);
    expect(easeHole({ x: 0, y: 0, width: 50, height: 50 }, to, 0.5)).toEqual({ x: 50, y: 50, width: 50, height: 50 });
  });

  it('joins lit rectangles that overlap, so no ring crosses the other', () => {
    const island = { x: 100, y: 100, width: 300, height: 400 };
    const bar = { x: 120, y: 480, width: 280, height: 60 };
    const far = { x: 600, y: 10, width: 50, height: 20 };
    expect(mergeHoles([island, far, bar])).toEqual([far, { x: 100, y: 100, width: 300, height: 440 }]);
    expect(mergeHoles([island, far])).toEqual([island, far]);
  });

  it('puts the host card in the first corner that covers nothing lit, else the one covering least', () => {
    const view = { width: 1000, height: 800 };
    const card = { width: 300, height: 200 };
    const margin = { side: 16, top: 64, bottom: 110 };
    expect(placeCard([], view, card, margin)).toEqual({ left: 16, top: 64 });
    const marketCard = { x: 200, y: 100, width: 500, height: 200 };
    expect(placeCard([marketCard], view, card, margin)).toEqual({ left: 16, top: 490 });
    const everywhere = { x: 0, y: 0, width: 1000, height: 700 };
    const topLeftFree = { x: 0, y: 300, width: 1000, height: 500 };
    expect(placeCard([everywhere], view, card, margin)).toEqual({ left: 16, top: 64 });
    expect(placeCard([topLeftFree], view, card, margin)).toEqual({ left: 16, top: 64 });
  });

  it('marks a target done by its element: picked, or enough crates on the ship', () => {
    expect(isDone({ kind: 'role', role: 'guard' }, { done: 'true' })).toBe(true);
    expect(isDone({ kind: 'role', role: 'guard' }, { done: 'false' })).toBe(false);
    expect(isDone({ kind: 'crate', good: 'wood', count: 1 }, { loaded: '0' })).toBe(false);
    expect(isDone({ kind: 'crate', good: 'wood', count: 1 }, { loaded: '1' })).toBe(true);
  });

  it('lights the first guide group on screen and not done, skipping groups that are gone', () => {
    const role: FocusTarget = { kind: 'role', role: 'guard' };
    const ship: FocusTarget = { kind: 'target', player: 'p1' };
    const other: FocusTarget = { kind: 'target', player: 'p2' };
    const screen = new Map<FocusTarget, { done?: string }[]>([
      [role, [{ done: 'false' }]],
      [ship, [{ done: 'false' }]],
      [other, []],
    ]);
    const find = (t: FocusTarget) => screen.get(t) ?? [];
    const marks = (m: { done?: string }) => m;
    expect(currentGuide([[role], [ship]], find, marks)).toBe(0);
    screen.set(role, [{ done: 'true' }]);
    expect(currentGuide([[role], [ship]], find, marks)).toBe(1);
    expect(currentGuide([[role], [other], [ship]], find, marks)).toBe(2);
    expect(currentGuide([[role], [ship, other]], find, marks)).toBe(1);
    screen.set(ship, [{ done: 'true' }]);
    expect(currentGuide([[role], [ship]], find, marks)).toBe(-1);
  });

  it('frames an island with marks on its shore and over its buildings', () => {
    const points = islandMarkPoints(Math.PI / 2);
    expect(points.length).toBeGreaterThan(8);
    expect(Math.max(...points.map((p) => p[1]))).toBeGreaterThan(5);
  });
});

describe('tutorial menu', () => {
  it('lists every lesson exactly once', async () => {
    const { TUTORIAL_GROUPS } = await import('../../src/ui-v07/tutorial/TutorialMenu');
    const { TUTORIALS } = await import('../../src/v07/tutorial');
    expect(TUTORIAL_GROUPS.flatMap((g) => g.ids).sort()).toEqual(TUTORIALS.map((t) => t.id).sort());
  });
});
