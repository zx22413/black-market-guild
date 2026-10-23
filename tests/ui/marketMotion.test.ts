import { describe, expect, it } from 'vitest';
import { FLIP, awningAngle, bellSwing, flipAngle, flipShowsNew, lanternLitAt, pathLength, walkAt } from '../../src/ui/scene/marketMotion';
import type { Vec3 } from '../../src/ui/scene/buildings/polyhedra';

const PATH: Vec3[] = [
  [0, 0, 0],
  [3, 0, 0],
  [3, 1, 4],
];

describe('market walks', () => {
  it('measures an open path without a leg back to the start', () => {
    expect(pathLength(PATH)).toBeCloseTo(3 + Math.hypot(1, 4));
  });

  it('holds the walker at either end and faces it along its leg', () => {
    expect(walkAt(PATH, -1).at).toEqual([0, 0, 0]);
    walkAt(PATH, 99).at.forEach((v, i) => expect(v).toBeCloseTo(PATH[2]![i]!));
    const { at, heading } = walkAt(PATH, 1.5);
    expect(at[0]).toBeCloseTo(1.5);
    expect(heading).toBeCloseTo(0);
  });

  it('lights a lantern where the pole first reaches it, and never one out of reach', () => {
    const [near, far, high] = lanternLitAt(PATH, [[2, 1, 0.5], [10, 1, 10], [1, 5, 0]], 0.75, 1.7);
    expect(near).toBeGreaterThan(1.1);
    expect(near).toBeLessThan(2);
    expect(far).toBe(Infinity);
    expect(high).toBe(Infinity);
  });
});

describe('market moving parts', () => {
  it('turns a board row over once and shows the new price from the moment it is edge-on', () => {
    expect(flipAngle(0)).toBe(0);
    expect(flipAngle(FLIP.time)).toBeCloseTo(Math.PI * 2);
    expect(flipAngle(-1)).toBe(0);
    expect(flipShowsNew(FLIP.time / 2 - 0.01)).toBe(false);
    expect(flipShowsNew(FLIP.time / 2)).toBe(true);
  });

  it('swings the bell a few strokes that die away, then hangs still', () => {
    expect(bellSwing(-1)).toBe(0);
    expect(Math.abs(bellSwing(0.22))).toBeGreaterThan(Math.abs(bellSwing(2.0)));
    expect(bellSwing(5)).toBe(0);
  });

  it('eases an awning from where it was to where it is going', () => {
    expect(awningAngle(0.3, -1.3, 0)).toBeCloseTo(0.3);
    expect(awningAngle(0.3, -1.3, 10)).toBeCloseTo(-1.3);
    expect(awningAngle(0.3, -1.3, 0.45)).toBeLessThan(0.3);
  });
});
