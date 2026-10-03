import { describe, expect, it } from 'vitest';
import type { KitPart } from '../../src/ui/scene/buildings/kit';
import { partFaces, type Vec2 } from '../../src/ui/scene/buildings/polyhedra';
import {
  ENVELOPE_HALF_WIDTH,
  HANDS_A,
  MEDAL_B,
  SCROLL_HALF_WIDTH,
  clipConvex,
  envelopeHalf,
  ribbonB,
  scrollHalf,
  sleeveA,
  tearLine,
} from '../../src/ui/scene/props/recruitProps';

const extent = (parts: readonly KitPart[]) => {
  const points = parts.flatMap(partFaces).flatMap((f) => f.points);
  const range = (axis: 0 | 1 | 2): [number, number] => [Math.min(...points.map((p) => p[axis])), Math.max(...points.map((p) => p[axis]))];
  return { x: range(0), y: range(1), z: range(2) };
};

/** Signed area of a polygon in the xz plane; positive when counter-clockwise. */
const area = (polygon: readonly Vec2[]): number =>
  polygon.reduce((sum, [x, z], i) => {
    const [x2, z2] = polygon[(i + 1) % polygon.length]!;
    return sum + x * z2 - x2 * z;
  }, 0) / 2;

const ALL: Record<string, readonly KitPart[]> = {
  'scroll left': scrollHalf(-1),
  'scroll right': scrollHalf(1),
  'envelope left': envelopeHalf(-1),
  'envelope right': envelopeHalf(1),
  'hands (A)': HANDS_A,
  'sleeve left (A)': sleeveA(-1),
  'sleeve right (A)': sleeveA(1),
  'medal (B)': MEDAL_B,
  'ribbon left (B)': ribbonB(-1),
  'ribbon right (B)': ribbonB(1),
};

describe('recruitment show props', () => {
  it.each(Object.entries(ALL))('%s is made of closed solids', (_, parts) => {
    for (const part of parts) {
      const faces = partFaces(part);
      expect(faces.length).toBeGreaterThanOrEqual(4);
      for (const face of faces) expect(Math.hypot(...face.normal)).toBeCloseTo(1, 3);
    }
  });

  it('tears along a zig-zag that starts and ends on the cut line', () => {
    const line = tearLine(0, 0, -1, 1, 6);
    expect(line[0]).toEqual([0, -1]);
    expect(line[line.length - 1]).toEqual([0, 1]);
    expect(new Set(line.slice(1, -1).map(([x]) => Math.sign(x))).size).toBe(2);
  });

  it('fills the whole scroll sheet with its two torn halves', () => {
    const sheet = (side: 1 | -1) =>
      scrollHalf(side)
        .filter((p) => p.mat === 'plaster')
        .reduce((sum, p) => sum + (p.kind === 'loft' ? Math.abs(area(p.outline)) : 0), 0);
    const whole = 2 * SCROLL_HALF_WIDTH * 2 * 0.75;
    expect(sheet(-1) + sheet(1)).toBeCloseTo(whole, 5);
  });

  it('mirrors the scroll halves, rolled ends included', () => {
    const left = extent(scrollHalf(-1));
    const right = extent(scrollHalf(1));
    expect(left.x[0]).toBeCloseTo(-right.x[1], 5);
    expect(left.z).toEqual(right.z);
  });

  it('splits the envelope flap and seal along the cut, so each half keeps a piece of both', () => {
    for (const side of [-1, 1] as const) {
      const half = envelopeHalf(side);
      expect(half.filter((p) => p.mat === 'rope')).toHaveLength(1);
      expect(half.filter((p) => p.mat === 'roofRed')).toHaveLength(1);
    }
    const flaps = ([-1, 1] as const).map((s) => envelopeHalf(s).find((p) => p.mat === 'rope')!);
    const flapArea = flaps.reduce((sum, p) => sum + (p.kind === 'loft' ? Math.abs(area(p.outline)) : 0), 0);
    // The two pieces make up the whole flap triangle.
    expect(flapArea).toBeCloseTo(ENVELOPE_HALF_WIDTH * (0.55 + 0.08), 5);
  });

  it('keeps every envelope piece inside the envelope', () => {
    for (const side of [-1, 1] as const) {
      const box = extent(envelopeHalf(side));
      expect(box.x[0]).toBeGreaterThanOrEqual(-ENVELOPE_HALF_WIDTH - 1e-6);
      expect(box.x[1]).toBeLessThanOrEqual(ENVELOPE_HALF_WIDTH + 1e-6);
    }
  });

  it('clips a convex polygon to either side of a line', () => {
    const square: Vec2[] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const left = clipConvex(square, [0, -2], [0, 2], -1);
    const right = clipConvex(square, [0, -2], [0, 2], 1);
    expect(Math.abs(area(left))).toBeCloseTo(2, 5);
    expect(Math.abs(area(right))).toBeCloseTo(2, 5);
    expect(Math.max(...left.map(([x]) => x))).toBeCloseTo(0, 5);
  });

  it('puts the sleeves outside the clasped hands, one on each side', () => {
    const hands = extent(HANDS_A);
    expect(extent(sleeveA(1)).x[1]).toBeGreaterThan(hands.x[1]);
    expect(extent(sleeveA(-1)).x[0]).toBeLessThan(hands.x[0]);
  });

  it('embosses the handshake on the face of the medal, inside its rim', () => {
    const disc = MEDAL_B[0]!;
    const relief = MEDAL_B.filter((p) => p.mat === 'brass' || p.mat === 'roofGold').filter((p) => p.kind !== 'beam' || p.width < 0.08);
    expect(disc.kind).toBe('prism');
    const box = extent(relief);
    expect(Math.max(Math.abs(box.x[0]), Math.abs(box.x[1]))).toBeLessThan(1);
    expect(box.y[0]).toBeGreaterThanOrEqual(0.1);
  });

  it('hangs the two ribbons below the medal, one on each side', () => {
    expect(extent(ribbonB(1)).x[0]).toBeGreaterThanOrEqual(0);
    expect(extent(ribbonB(-1)).x[1]).toBeLessThanOrEqual(0);
    expect(extent(ribbonB(1)).z[1]).toBeGreaterThan(1);
  });
});
