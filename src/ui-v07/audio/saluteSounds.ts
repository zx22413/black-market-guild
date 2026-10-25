// The fortress's salute (scene/IslandForces' Barrage) as sound: a pop as each gun fires, then as
// each flare comes down a splash and a ding, every ding a little higher than the one before.
// Pure, so the timing is tested without audio.

import { BARRAGE, SHOTS, landsAt } from '../scene/islandForceMath';
import type { SfxId } from './soundPlan';

export interface TimedSound {
  /** Seconds into the salute. */
  readonly at: number;
  readonly id: SfxId;
  readonly rate: number;
}

/** How much higher each next ding rings, and how long after its splash. */
const DING_RISE = 0.12;
const DING_AFTER = 0.05;

export function saluteSounds(): TimedSound[] {
  return Array.from({ length: SHOTS }, (_, i): TimedSound[] => [
    { at: BARRAGE.first + i * BARRAGE.gap, id: 'salute-pop', rate: 1 },
    { at: landsAt(i), id: 'salute-splash', rate: 1 },
    { at: landsAt(i) + DING_AFTER, id: 'salute-ding', rate: 1 + i * DING_RISE },
  ])
    .flat()
    .sort((a, b) => a.at - b.at);
}
