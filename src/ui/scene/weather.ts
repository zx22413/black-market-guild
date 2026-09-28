import type { VoyageEventId } from '../../game';

export interface WeatherLook {
  readonly sky: string;
  readonly sea: string;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly sun: number;
  readonly sunColor: string;
  readonly ambient: number;
}

const DAY: WeatherLook = { sky: '#9fd4e0', sea: '#2fa3a8', fogNear: 90, fogFar: 220, sun: 2.6, sunColor: '#fff3d6', ambient: 1.1 };

/** How the table looks under each voyage event; before the reveal the sea is a clear day. */
export const WEATHER: Readonly<Record<VoyageEventId | 'clear', WeatherLook>> = {
  clear: DAY,
  'calm-seas': { ...DAY, sea: '#3bb5b0' },
  tailwind: { ...DAY, sky: '#b9e3ea', sun: 2.9 },
  storm: { sky: '#4b5866', sea: '#2d5560', fogNear: 60, fogFar: 170, sun: 0.9, sunColor: '#c9d6e0', ambient: 0.8 },
  'sea-fog': { sky: '#c8d3d6', sea: '#6f9ea3', fogNear: 70, fogFar: 175, sun: 1.2, sunColor: '#ffffff', ambient: 1.2 },
  'moonless-night': { sky: '#0f1a2b', sea: '#173848', fogNear: 70, fogFar: 200, sun: 0.35, sunColor: '#9fb4ff', ambient: 0.35 },
  'high-waves': { sky: '#7fa9bb', sea: '#1f7f93', fogNear: 80, fogFar: 200, sun: 1.8, sunColor: '#f2f6ff', ambient: 0.9 },
  'black-market-rush': { sky: '#e9b98a', sea: '#2f8f99', fogNear: 90, fogFar: 220, sun: 2.2, sunColor: '#ffd29a', ambient: 1 },
};
