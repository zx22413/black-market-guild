import { describe, expect, it } from 'vitest';
import { easeHole, focusSelector, holeAround, mergeHoles } from '../../src/ui-v07/tutorial/focus';
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
