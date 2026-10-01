import type { VoyageEventId } from '../../game';

/** How rough the sea moves; every value is a multiplier on the clear-day motion (1 = clear day). */
export interface Swell {
  /** Height of the long rolling waves. */
  readonly height: number;
  /** How fast the waves travel. */
  readonly speed: number;
  /** How hard ships bob, roll and pitch. */
  readonly roll: number;
  /** Foam at the shores, 0 (a thin line) to 1 (wide, churning, with streaks on open water); not a multiplier. */
  readonly foam: number;
}

export interface WeatherLook {
  readonly sky: string;
  readonly sea: string;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly sun: number;
  readonly sunColor: string;
  readonly ambient: number;
  readonly swell: Swell;
}

const STEADY: Swell = { height: 1, speed: 1, roll: 1, foam: 0.2 };

const DAY: WeatherLook = { sky: '#9fd4e0', sea: '#2fa3a8', fogNear: 90, fogFar: 220, sun: 2.6, sunColor: '#fff3d6', ambient: 1.1, swell: STEADY };

/** How the table looks under each voyage event; before the reveal the sea is a clear day. */
export const WEATHER: Readonly<Record<VoyageEventId | 'clear', WeatherLook>> = {
  clear: DAY,
  'calm-seas': { ...DAY, sea: '#3bb5b0', swell: { height: 0.35, speed: 0.55, roll: 0.4, foam: 0 } },
  tailwind: { ...DAY, sky: '#b9e3ea', sun: 2.9, swell: { height: 1.1, speed: 1.8, roll: 1.4, foam: 0.45 } },
  storm: {
    sky: '#4b5866', sea: '#2d5560', fogNear: 60, fogFar: 170, sun: 0.9, sunColor: '#c9d6e0', ambient: 0.8,
    swell: { height: 1.9, speed: 2.1, roll: 3.2, foam: 0.75 },
  },
  'sea-fog': {
    sky: '#c8d3d6', sea: '#6f9ea3', fogNear: 70, fogFar: 175, sun: 1.2, sunColor: '#ffffff', ambient: 1.2,
    swell: { height: 0.55, speed: 0.6, roll: 0.6, foam: 0 },
  },
  'moonless-night': {
    sky: '#0f1a2b', sea: '#173848', fogNear: 70, fogFar: 200, sun: 0.35, sunColor: '#9fb4ff', ambient: 0.35,
    swell: { height: 0.8, speed: 0.75, roll: 0.8, foam: 0.1 },
  },
  'high-waves': {
    sky: '#7fa9bb', sea: '#1f7f93', fogNear: 80, fogFar: 200, sun: 1.8, sunColor: '#f2f6ff', ambient: 0.9,
    swell: { height: 2.4, speed: 1.3, roll: 4, foam: 0.9 },
  },
  'black-market-rush': {
    sky: '#e9b98a', sea: '#2f8f99', fogNear: 90, fogFar: 220, sun: 2.2, sunColor: '#ffd29a', ambient: 1,
    swell: { height: 1, speed: 1.25, roll: 1.1, foam: 0.3 },
  },
};

/** Seconds-scale rate at which the sea settles into a new event's swell (~4 s to mostly settle). */
const SWELL_EASE_RATE = 0.8;

/** One frame of easing from the current swell toward the event's swell, so weather changes roll in. */
export function easeSwell(current: Swell, target: Swell, delta: number): Swell {
  const k = 1 - Math.exp(-delta * SWELL_EASE_RATE);
  const step = (from: number, to: number) => from + (to - from) * k;
  return {
    height: step(current.height, target.height),
    speed: step(current.speed, target.speed),
    roll: step(current.roll, target.roll),
    foam: step(current.foam, target.foam),
  };
}

/**
 * Dev-only `?weather=<event id>` override, so each sea can be previewed without waiting for the
 * event to come up in a match. Unknown ids are ignored.
 */
export function devWeatherOverride(search: string): VoyageEventId | null {
  const id = new URLSearchParams(search).get('weather');
  return id && id !== 'clear' && Object.hasOwn(WEATHER, id) ? (id as VoyageEventId) : null;
}
