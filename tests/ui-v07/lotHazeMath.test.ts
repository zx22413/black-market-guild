import { describe, expect, it } from 'vitest';
import { HAZE_FAR, HAZE_NEAR, hazeRange } from '../../src/ui-v07/scene/lotHazeMath';

describe('the fog behind the building in its close-up', () => {
  const weather = { near: 90, far: 220 };

  it('leaves the weather alone until the close-up starts', () => {
    expect(hazeRange(weather, 20, 0)).toEqual(weather);
  });

  it('closes in just past the building, which stays clear', () => {
    const range = hazeRange(weather, 20, 1);
    expect(range.near).toBeCloseTo(20 * HAZE_NEAR);
    expect(range.far).toBeCloseTo(20 * HAZE_FAR);
    expect(range.near).toBeGreaterThan(20);
  });

  it('glides between the two, and never pushes the weather further out', () => {
    const half = hazeRange(weather, 20, 0.5);
    expect(half.near).toBeCloseTo((90 + 24) / 2);
    expect(hazeRange({ near: 10, far: 30 }, 20, 1)).toEqual({ near: 10, far: 30 });
    expect(hazeRange(weather, 20, 5)).toEqual(hazeRange(weather, 20, 1));
  });
});
