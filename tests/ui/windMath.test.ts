import { describe, expect, it } from 'vitest';
import { WIND_DIRECTION, strokeWindow, windPath } from '../../src/ui/scene/windMath';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const along = ([x, , z]: readonly number[], [sx, sz]: readonly [number, number]) =>
  (x! - sx) * WIND_DIRECTION[0] + (z! - sz) * WIND_DIRECTION[1];

describe('wind lines', () => {
  it('blows toward the lower left of the screen, like the rain', () => {
    expect(WIND_DIRECTION[0]).toBeLessThan(0);
    expect(WIND_DIRECTION[1]).toBeGreaterThan(0);
    expect(Math.hypot(...WIND_DIRECTION)).toBeCloseTo(1, 6);
  });

  it('runs downwind from its start, above the sea', () => {
    const random = seeded(4);
    for (let n = 0; n < 30; n++) {
      const start: [number, number] = [10, -5];
      const path = windPath(start, random);
      expect(path.length).toBeGreaterThan(20);
      const [x0, , z0] = path[0]!;
      expect(Math.hypot(x0 - 10, z0 + 5)).toBeLessThan(0.01);
      expect(along(path[path.length - 1]!, start)).toBeGreaterThan(20);
      for (const [, y] of path) expect(y).toBeGreaterThan(0.5);
    }
  });

  it('sometimes curls into a loop that turns back upwind for a moment', () => {
    const random = seeded(9);
    const loops = Array.from({ length: 40 }, () => {
      const path = windPath([0, 0], random);
      return path.some((p, i) => i > 0 && along(p, [0, 0]) < along(path[i - 1]!, [0, 0]) - 0.05);
    });
    expect(loops.some(Boolean)).toBe(true);
    expect(loops.every(Boolean)).toBe(false);
  });

  it('draws on from the tail end, slides, then wipes off, never inverted', () => {
    expect(strokeWindow(0)).toEqual([0, 0]);
    expect(strokeWindow(1)).toEqual([1, 1]);
    let previous = strokeWindow(0);
    for (let k = 0.05; k <= 1; k += 0.05) {
      const [tail, head] = strokeWindow(k);
      expect(head).toBeGreaterThanOrEqual(tail);
      expect(head).toBeGreaterThanOrEqual(previous[1]);
      expect(tail).toBeGreaterThanOrEqual(previous[0]);
      previous = [tail, head];
    }
    const [tail, head] = strokeWindow(0.5);
    expect(head - tail).toBeGreaterThan(0.2);
  });
});
