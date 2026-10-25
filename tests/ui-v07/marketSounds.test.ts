import { describe, expect, it } from 'vitest';
import { marketCloses, marketSound } from '../../src/ui-v07/audio/marketSounds';
import type { MarketRow } from '../../src/ui-v07/table3d/settlementModel';

const row = (before: number, after: number): MarketRow => ({ good: 'wood', demand: 2, brokerShift: 0, arrived: 1, before, after });
const rows = [row(3, 4), row(3, 2), row(3, 3), row(2, 4), row(4, 2)];

describe('sound of each market row as it shows', () => {
  it('rings a price going up, falls for one going down, stays quiet when it holds', () => {
    expect(marketSound(rows, 0, 1)).toEqual({ id: 'price-up', rate: 1 });
    expect(marketSound(rows, 1, 2)).toEqual({ id: 'price-down', rate: 1 });
    expect(marketSound(rows, 2, 3)).toBeNull();
  });

  it('pitches a two-step move further (spice moves two)', () => {
    expect(marketSound(rows, 3, 4)).toEqual({ id: 'price-up', rate: 1.12 });
    expect(marketSound(rows, 4, 5)).toEqual({ id: 'price-down', rate: 1 / 1.12 });
  });

  it('sounds only the last row when the card is skipped ahead, and nothing without a new row', () => {
    expect(marketSound(rows, 0, 2)).toEqual({ id: 'price-down', rate: 1 });
    expect(marketSound(rows, 2, 2)).toBeNull();
  });
});

describe('the market card closing', () => {
  it('brings the plank down once the last row has shown, also when skipped straight to it', () => {
    expect(marketCloses(rows, 4, 5)).toBe(true);
    expect(marketCloses(rows, 0, 5)).toBe(true);
  });

  it('stays quiet before the last row, after it, and for a card with no rows', () => {
    expect(marketCloses(rows, 3, 4)).toBe(false);
    expect(marketCloses(rows, 5, 5)).toBe(false);
    expect(marketCloses([], 0, 0)).toBe(false);
  });
});
