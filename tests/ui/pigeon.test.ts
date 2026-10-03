import { describe, expect, it } from 'vitest';
import { PIGEON_BODY, PIGEON_COLLAR, PIGEON_SHOULDER, pigeonWing } from '../../src/ui/scene/props/pigeon';
import { partFaces } from '../../src/ui/scene/buildings/polyhedra';

const extent = (parts: readonly Parameters<typeof partFaces>[0][]) => {
  const points = parts.flatMap(partFaces).flatMap((f) => f.points);
  const range = (axis: 0 | 1 | 2): [number, number] => [Math.min(...points.map((p) => p[axis])), Math.max(...points.map((p) => p[axis]))];
  return { x: range(0), y: range(1), z: range(2) };
};

describe('carrier pigeon model', () => {
  it('builds closed solids for every part', () => {
    for (const part of [...PIGEON_BODY, ...pigeonWing(1), ...pigeonWing(-1)]) {
      const faces = partFaces(part);
      expect(faces.length).toBeGreaterThanOrEqual(5);
      for (const face of faces) {
        expect(face.points.length).toBeGreaterThanOrEqual(3);
        expect(Math.hypot(...face.normal)).toBeCloseTo(1, 3);
      }
    }
  });

  it('faces +z: the beak is the front-most part and the tail trails behind', () => {
    const body = extent(PIGEON_BODY);
    expect(body.z[1]).toBeGreaterThan(0.8);
    expect(body.z[0]).toBeLessThan(-0.9);
  });

  it('keeps the body narrow enough for the wings to be what makes it wide', () => {
    const body = extent(PIGEON_BODY);
    const wing = extent(pigeonWing(1));
    expect(body.x[1] - body.x[0]).toBeLessThan(0.8);
    expect(wing.x[1]).toBeGreaterThan(1);
  });

  it('mirrors the left wing from the right one', () => {
    const right = extent(pigeonWing(1));
    const left = extent(pigeonWing(-1));
    expect(left.x[0]).toBeCloseTo(-right.x[1], 5);
    expect(left.x[1]).toBeCloseTo(-right.x[0], 5);
    expect(left.z).toEqual(right.z);
  });

  it('puts the guild-colored collar around the neck, wider than the neck itself', () => {
    for (const part of PIGEON_COLLAR) expect(partFaces(part).length).toBeGreaterThanOrEqual(5);
    const collar = extent(PIGEON_COLLAR);
    const body = extent(PIGEON_BODY);
    // Between the body's middle and the head, and inside the bird's length.
    expect(collar.z[0]).toBeGreaterThan(body.z[0]);
    expect(collar.z[1]).toBeLessThan(body.z[1]);
    expect(collar.x[1] - collar.x[0]).toBeGreaterThan(0.3);
  });

  it('hinges the wings on the back, above the belly', () => {
    const body = extent(PIGEON_BODY);
    expect(PIGEON_SHOULDER.y).toBeGreaterThan(body.y[0]);
    expect(PIGEON_SHOULDER.y).toBeLessThan(body.y[1]);
  });
});
