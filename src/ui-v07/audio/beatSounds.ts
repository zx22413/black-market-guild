// The sound of each moment in a ship's beat (the die, each modifier, the outcome), worked out from
// what the beat shows before and after a cue. Pure, so the mapping is tested without audio.

import type { VoyageEventId } from '../../v07/game';
import type { BeatView } from '../beats/beatTimeline';
import type { BeatStep, ShipBeat } from '../beats/shipBeat';
import type { SkillMoment } from '../beats/skillShow';
import type { SfxId } from './soundPlan';

const EVENT_STEP: Readonly<Partial<Record<VoyageEventId, SfxId>>> = {
  tailwind: 'event-tailwind',
  // The storm's step is sounded by the scene, on the bolt's flash (BeatScene's HitFx), to stay in sync.
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

/** V0.8: a ship skill going off on the die (好兆頭's reroll, 巨浪's extra die). */
const DIE_SKILL: Partial<Record<SkillMoment['effect'], SfxId>> = { reroll: 'skill-omen', 'extra-die': 'skill-surge' };

/**
 * The sound for what `now` shows that `before` did not (null `before`: a new beat). When a skip
 * jumps over several moments at once only the latest one sounds, not a pile of them together.
 */
export function beatSound(beat: ShipBeat, before: BeatView | null, now: BeatView): SfxId | null {
  if (now.showOutcome && !before?.showOutcome) {
    // 加注 that came in (×4) rings its jackpot in place of the bell; one that did not sinks like any other ship.
    if (beat.outcome === 'arrived' && beat.skills.some((m) => m.effect === 'raise-won')) return 'skill-raise-won';
    return beat.outcome === 'arrived' ? 'arrive' : 'sink';
  }
  // V0.8: each lost crate splashes as it goes overboard.
  if (now.dropsShown > (before?.dropsShown ?? 0)) return 'crate-drop';
  const stepsBefore = before?.stepsShown ?? 0;
  if (now.stepsShown > stepsBefore) {
    const step = beat.steps[now.stepsShown - 1];
    return step ? stepSound(step) : null;
  }
  if (now.skillsShown > (before?.skillsShown ?? 0)) {
    const skill = beat.skills.filter((m) => m.at === 'die')[now.skillsShown - 1];
    return skill ? (DIE_SKILL[skill.effect] ?? null) : null;
  }
  // 最後的大市集: the low die knocked away and the high one kept.
  if (now.gamble === 'picked' && before?.gamble !== 'picked') return 'gamble-pick';
  if (now.showStart && !before?.showStart) return 'dice';
  return null;
}
