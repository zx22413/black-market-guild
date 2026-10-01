import { describe, expect, it } from 'vitest';
import { WEATHER, devWeatherOverride, easeSwell, type Swell } from '../../src/ui/scene/weather';

const CALM: Swell = { height: 0.4, speed: 0.6, roll: 0.5, foam: 0 };
const ROUGH: Swell = { height: 2.4, speed: 1.4, roll: 3, foam: 0.8 };

describe('sea swell', () => {
  it('gives storms and high waves a rougher sea than calm seas', () => {
    const calm = WEATHER['calm-seas'].swell;
    for (const rough of [WEATHER.storm.swell, WEATHER['high-waves'].swell]) {
      expect(rough.height).toBeGreaterThan(calm.height);
      expect(rough.roll).toBeGreaterThan(calm.roll);
      expect(rough.foam).toBeGreaterThan(calm.foam);
    }
  });

  it('eases part of the way toward the target each frame without mutating the input', () => {
    const before = { ...CALM };
    const next = easeSwell(CALM, ROUGH, 0.1);
    expect(CALM).toEqual(before);
    expect(next.height).toBeGreaterThan(CALM.height);
    expect(next.height).toBeLessThan(ROUGH.height);
    expect(next.roll).toBeGreaterThan(CALM.roll);
  });

  it('settles on the target after a few seconds', () => {
    let swell = CALM;
    for (let i = 0; i < 600; i++) swell = easeSwell(swell, ROUGH, 1 / 60);
    expect(swell.height).toBeCloseTo(ROUGH.height, 2);
    expect(swell.roll).toBeCloseTo(ROUGH.roll, 2);
    expect(swell.foam).toBeCloseTo(ROUGH.foam, 2);
  });
});

describe('dev weather override', () => {
  it('accepts a known voyage event id and ignores anything else', () => {
    expect(devWeatherOverride('?weather=storm')).toBe('storm');
    expect(devWeatherOverride('?weather=clear')).toBeNull();
    expect(devWeatherOverride('?weather=toString')).toBeNull();
    expect(devWeatherOverride('')).toBeNull();
  });
});
