import { describe, expect, it } from 'vitest';
import { WEATHER, devWeatherOverride, easeSwell, fillOf, type Swell } from '../../src/ui/scene/weather';

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

describe('night', () => {
  it('lights a moonless night with a blue fill instead of leaving it black', () => {
    const night = fillOf(WEATHER['moonless-night']);
    const day = fillOf(WEATHER.clear);
    expect(night.sky).not.toBe(day.sky);
    expect(night.intensity).toBeGreaterThan(0.5);
    expect(day).toEqual({ sky: WEATHER.clear.sky, ground: '#3a6b4a', intensity: 0.6 });
  });

  it('darkens the sea toward the corners only at night', () => {
    expect(WEATHER['moonless-night'].vignette).toBeGreaterThan(0);
    for (const [id, look] of Object.entries(WEATHER)) if (id !== 'moonless-night') expect(look.vignette ?? 0).toBe(0);
  });

  it('gives the night sea faintly glowing white wave lines; only the night glows', () => {
    const night = WEATHER['moonless-night'];
    expect(night.seaLines).toBeGreaterThan(0);
    expect(night.seaGlow).toBeGreaterThan(0);
    for (const [id, look] of Object.entries(WEATHER)) if (id !== 'moonless-night') expect(look.seaGlow ?? 0).toBe(0);
  });
});

describe('fair weather', () => {
  it('draws white wave lines on the sea and floats clouds over a clear day and calm seas', () => {
    for (const look of [WEATHER.clear, WEATHER['calm-seas']]) {
      expect(look.seaLines).toBeGreaterThan(0);
      expect(look.clouds).toBeGreaterThan(0);
    }
  });

  it('keeps clouds off the storm, fog and night skies', () => {
    for (const id of ['storm', 'sea-fog', 'moonless-night'] as const) expect(WEATHER[id].clouds ?? 0).toBe(0);
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
