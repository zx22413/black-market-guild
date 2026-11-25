import { describe, expect, it } from 'vitest';
import { scriptedDice } from '../../../src/v07/tutorial/stage';

describe('scriptedDice', () => {
  it('keeps the scripted roll as the highest of the dice thrown', () => {
    expect(scriptedDice(2, 3)).toEqual([2, 3]);
    expect(Math.max(...scriptedDice(3, 5))).toBe(5);
    expect(scriptedDice(3, 5)).toEqual([4, 3, 5]);
  });

  it('never goes below 1, and a single die is the roll itself', () => {
    expect(scriptedDice(2, 1)).toEqual([1, 1]);
    expect(scriptedDice(1, 4)).toEqual([4]);
  });
});
