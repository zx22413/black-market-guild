import type { WeatherLook } from '../../ui/scene/weather';
import type { TideKind } from '../../v07/game';

// V0.8 prototype (an experiment, not rules): how the table looks in the dark-tide season. Whatever the round's weather,
// the sea turns toward the tide's own dark water, the sky dims with it, the corners sink and the foam glows faintly,
// so the season reads at a glance and each tide has its colour.

/** Each tide's water: storm deep blue, pirate wine dark, inspection indigo, crash dark green. */
export const TIDE_WATER: Readonly<Record<TideKind, string>> = { storm: '#0f3552', pirate: '#3d1c2c', inspection: '#262b55', crash: '#174536' };

/** How far the sea and the sky go toward the tide's water (0 = the weather's own colour, 1 = the tide's). */
const SEA_MIX = 0.62;
const SKY_MIX = 0.38;
const VIGNETTE = 0.6;
const GLOW = 0.35;
const SUN = 0.85;

const channels = (hex: string): readonly [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** `a` mixed `t` of the way to `b` (both #rrggbb). */
export function mixHex(a: string, b: string, t: number): string {
  const [x, y] = [channels(a), channels(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** The weather's look under `tide` (null: unchanged). */
export function tideLook(look: WeatherLook, tide: TideKind | null): WeatherLook {
  if (tide === null) return look;
  const water = TIDE_WATER[tide];
  return {
    ...look,
    sea: mixHex(look.sea, water, SEA_MIX),
    sky: mixHex(look.sky, water, SKY_MIX),
    sun: look.sun * SUN,
    vignette: Math.max(look.vignette ?? 0, VIGNETTE),
    seaGlow: Math.max(look.seaGlow ?? 0, GLOW),
  };
}
