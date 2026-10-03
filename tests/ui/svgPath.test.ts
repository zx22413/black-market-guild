import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../src/ui/scene/buildings/polyhedra';
import { pathRings, signedArea, simplifyRing, triangulate } from '../../src/ui/scene/props/svgPath';

const area = (ring: readonly Vec2[]): number => Math.abs(signedArea(ring)) / 2;

describe('svg path to solids', () => {
  it('reads absolute and relative moves, lines and closes into rings', () => {
    const rings = pathRings('M0 0 L10 0 L10 10 Z m20 0 h10 v10 h-10 z');
    expect(rings).toHaveLength(2);
    expect(rings[0]).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    // The relative move starts from the first ring's start point.
    expect(rings[1]![0]).toEqual([20, 0]);
    expect(area(rings[1]!)).toBeCloseTo(100, 5);
  });

  it('samples cubic curves and reads numbers packed without separators', () => {
    const [ring] = pathRings('M0 0c0-10 10-10 10 0-.5.5-1 1-10 0z', 4);
    expect(ring!.length).toBeGreaterThan(6);
    // The curve's end point is on the ring; the closing point that repeats the start is dropped.
    expect(ring).toContainEqual([10, 0]);
    expect(ring!.filter(([x, y]) => x === 0 && y === 0)).toHaveLength(1);
  });

  it('treats tiny arcs as straight lines to their end point', () => {
    const [ring] = pathRings('M0 0 l10 0 a5 5 0 0 1 2 3 l-12 0z');
    expect(ring).toContainEqual([12, 3]);
  });

  it('thins a densely sampled curve to a few corners without losing its shape', () => {
    const circle: Vec2[] = Array.from({ length: 120 }, (_, i) => [Math.cos((i / 120) * Math.PI * 2) * 50, Math.sin((i / 120) * Math.PI * 2) * 50]);
    const thin = simplifyRing(circle, 2);
    expect(thin.length).toBeLessThan(30);
    expect(thin.length).toBeGreaterThan(8);
    expect(area(thin) / area(circle)).toBeGreaterThan(0.95);
  });

  it('cuts a concave polygon into triangles that cover it exactly', () => {
    const arrow: Vec2[] = [
      [0, 0],
      [10, 5],
      [0, 10],
      [3, 5],
    ];
    const triangles = triangulate(arrow);
    expect(triangles).toHaveLength(2);
    expect(triangles.reduce((sum, t) => sum + area(t), 0)).toBeCloseTo(area(arrow), 5);
  });

  it('triangulates either winding', () => {
    const square: Vec2[] = [
      [0, 0],
      [0, 4],
      [4, 4],
      [4, 0],
    ];
    expect(triangulate(square).reduce((sum, t) => sum + area(t), 0)).toBeCloseTo(16, 5);
  });
});
