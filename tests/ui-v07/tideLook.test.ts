import { describe, expect, it } from 'vitest';
import { WEATHER } from '../../src/ui/scene/weather';
import { mixHex, TIDE_OMEN, TIDE_WATER, tideLook } from '../../src/ui-v07/scene/tideLook';

const luma = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};

describe('tideLook (V0.8 prototype, not rules)', () => {
  it('leaves the weather alone without a tide', () => {
    expect(tideLook(WEATHER.clear, null)).toBe(WEATHER.clear);
  });

  it('mixes two colours channel by channel', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#102030', '#102030', 0.7)).toBe('#102030');
  });

  it('darkens the sea and the sky under every tide, in every weather, and keeps the swell', () => {
    for (const tide of Object.keys(TIDE_WATER) as (keyof typeof TIDE_WATER)[]) {
      for (const look of Object.values(WEATHER)) {
        const dark = tideLook(look, tide);
        expect(luma(dark.sea)).toBeLessThan(luma(look.sea));
        expect(luma(dark.sky)).toBeLessThan(luma(look.sky));
        expect(dark.vignette).toBeGreaterThanOrEqual(0.6);
        expect(dark.swell).toBe(look.swell);
      }
    }
  });

  it('only begins to turn the sea in the round the tide is announced: darker than the weather, lighter than the season', () => {
    for (const tide of Object.keys(TIDE_WATER) as (keyof typeof TIDE_WATER)[]) {
      const [omen, season] = [tideLook(WEATHER.clear, tide, TIDE_OMEN), tideLook(WEATHER.clear, tide)];
      expect(luma(omen.sea)).toBeLessThan(luma(WEATHER.clear.sea));
      expect(luma(omen.sea)).toBeGreaterThan(luma(season.sea));
      expect(omen.vignette).toBeLessThan(season.vignette!);
      expect(omen.sun).toBeGreaterThan(season.sun);
    }
    expect(tideLook(WEATHER.clear, 'storm', 0)).toBe(WEATHER.clear);
  });

  it('gives each tide its own water', () => {
    const seas = (Object.keys(TIDE_WATER) as (keyof typeof TIDE_WATER)[]).map((t) => tideLook(WEATHER.clear, t).sea);
    expect(new Set(seas).size).toBe(4);
  });
});
