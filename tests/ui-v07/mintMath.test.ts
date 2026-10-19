import { describe, expect, it } from 'vitest';
import { MINT, MINT_SECONDS, isFresh, mintGlow } from '../../src/ui-v07/scene/mintMath';

describe('new crates turn gold', () => {
  it('flares to gold, holds, and cools back to plain wood', () => {
    expect(mintGlow(-0.1)).toBe(0);
    expect(mintGlow(MINT.flare)).toBe(1);
    expect(mintGlow(MINT.flare + MINT.hold / 2)).toBe(1);
    expect(mintGlow(MINT_SECONDS)).toBe(0);
    expect(mintGlow(MINT_SECONDS + 5)).toBe(0);
  });

  it('marks the top crates of a column as this round\'s', () => {
    // Three iron in stock, one of them made this round: the top one is new.
    expect([0, 1, 2].map((k) => isFresh(k, 3, 1))).toEqual([false, false, true]);
    expect([0, 1].map((k) => isFresh(k, 2, 2))).toEqual([true, true]);
    expect(isFresh(0, 1, 0)).toBe(false);
  });
});
