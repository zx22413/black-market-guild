import { describe, expect, it } from 'vitest';
import type { LandmarkDesign } from '../../src/ui/scene/buildings/landmarks';
import { LANDMARK_DESIGNS } from '../../src/ui/scene/buildings/landmarks';
import type { Vec3 } from '../../src/ui/scene/buildings/polyhedra';
import { loopLength, pointAlong, rushedDistance } from '../../src/ui/scene/buildings/islands/railway';

const SQUARE_LOOP: readonly Vec3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 0, 1],
  [0, 0, 1],
];

describe('railway loop', () => {
  it('runs round the loop and back to the start, facing the way the track runs', () => {
    expect(loopLength(SQUARE_LOOP)).toBeCloseTo(4);
    expect(pointAlong(SQUARE_LOOP, 0.5)).toEqual({ at: [0.5, 0, 0], toward: [1, 0, 0] });
    expect(pointAlong(SQUARE_LOOP, 3.5).toward).toEqual([0, 0, -1]);
    expect(pointAlong(SQUARE_LOOP, 4.5).at).toEqual(pointAlong(SQUARE_LOOP, 0.5).at);
    expect(pointAlong(SQUARE_LOOP, -0.5).at).toEqual(pointAlong(SQUARE_LOOP, 3.5).at);
  });

  it('keeps its own pace in the open and rushes through the rest, without a jump', () => {
    // Open from point 1 to point 2 (distance 1 to 2); everywhere else three times as fast.
    const shown = [1, 2] as const;
    const lap = 1 / 3 + 1 + 2 / 3;
    expect(rushedDistance(SQUARE_LOOP, shown, 3, 1 / 3)).toBeCloseTo(1);
    expect(rushedDistance(SQUARE_LOOP, shown, 3, 1 / 3 + 0.5)).toBeCloseTo(1.5);
    expect(rushedDistance(SQUARE_LOOP, shown, 3, lap + 0.1)).toBeCloseTo(0.3);
    const steps = Array.from({ length: 200 }, (_, i) => rushedDistance(SQUARE_LOOP, shown, 3, (i / 200) * lap));
    steps.slice(1).forEach((d, i) => {
      expect(d).toBeGreaterThan(steps[i]!);
      expect(d - steps[i]!).toBeLessThan(0.04);
    });
  });
});

describe('mine railway', () => {
  const train = (LANDMARK_DESIGNS.mountain as LandmarkDesign).train!;

  it('runs a few cars round the mountain, rushing through the tunnels', () => {
    expect(train.cars).toBeGreaterThan(1);
    expect(train.cars * train.spacing).toBeLessThan(loopLength(train.path) / 2);
    expect(train.shown[0]).toBeGreaterThan(0);
    expect(train.shown[1]).toBeLessThan(train.path.length - 1);
    expect(train.rush).toBeGreaterThan(1);
  });
});
