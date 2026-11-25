import { describe, expect, it } from 'vitest';
import { RAISE_SECONDS, isLanding, markRaising } from '../../src/ui-v07/scene/facilityLanding';

describe('facilityLanding', () => {
  it('is landing from the drop until it has settled', () => {
    markRaising(1000);
    expect(isLanding(1000 + 500)).toBe(true);
    expect(isLanding(1000 + RAISE_SECONDS * 1000 - 1)).toBe(true);
    expect(isLanding(1000 + RAISE_SECONDS * 1000 + 1000)).toBe(false);
  });
});
