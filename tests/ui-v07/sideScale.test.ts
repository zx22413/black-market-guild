import { describe, expect, it } from 'vitest';
import { SIDE_SCALE, scaledAbout } from '../../src/ui-v07/scene/sideScale';

describe('scaledAbout (where a point of a scaled group ends up)', () => {
  it('leaves the pivot where it is and pulls other points toward it', () => {
    const around = scaledAbout([10, 2, -4], 0.5);
    expect(around([10, 2, -4])).toEqual([10, 2, -4]);
    expect(around([12, 6, -4])).toEqual([11, 4, -4]);
    expect(around([8, 2, 0])).toEqual([9, 2, -2]);
  });

  it('is the identity at scale 1', () => {
    expect(scaledAbout([3, 3, 3], 1)([7, -1, 2])).toEqual([7, -1, 2]);
  });

  it('shrinks a stack\'s height as the crates shrink (the label stays on top of it)', () => {
    const around = scaledAbout([0, 0, 0], SIDE_SCALE);
    expect(around([0, 5, 0])[1]).toBeCloseTo(5 * SIDE_SCALE);
  });
});
