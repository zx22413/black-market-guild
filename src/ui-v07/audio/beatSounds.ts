// The sound of each moment in a ship's beat (the die, each modifier, the outcome), worked out from
// what the beat shows before and after a cue. Pure, so the mapping is tested without audio.

import type { VoyageEventId } from '../../v07/game';
import type { BeatView } from '../beats/beatTimeline';
import type { BeatStep, ShipBeat } from '../beats/shipBeat';
import type { SfxId } from './soundPlan';

const EVENT_STEP: Readonly<Partial<Record<VoyageEventId, SfxId>>> = {
  tailwind: 'event-tailwind',
  storm: 'event-storm',
  'sea-fog': 'event-fog',
  'moonless-night': 'event-moonless',
};

function stepSound(step: BeatStep): SfxId | null {
  switch (step.kind) {
    case 'guard':
      return 'guard';
    case 'pirate':
      return 'pirate';
    case 'event':
      return EVENT_STEP[step.source as VoyageEventId] ?? null;
    case 'island':
      return 'island';
    case 'clamp':
      return null;
  }
}

/**
 * The sound for what `now` shows that `before` did not (null `before`: a new beat). When a skip
 * jumps over several moments at once only the latest one sounds, not a pile of them together.
 */
export function beatSound(beat: ShipBeat, before: BeatView | null, now: BeatView): SfxId | null {
  if (now.showOutcome && !before?.showOutcome) return beat.outcome === 'arrived' ? 'arrive' : 'sink';
  const stepsBefore = before?.stepsShown ?? 0;
  if (now.stepsShown > stepsBefore) {
    const step = beat.steps[now.stepsShown - 1];
    return step ? stepSound(step) : null;
  }
  if (now.showStart && !before?.showStart) return 'dice';
  return null;
}
