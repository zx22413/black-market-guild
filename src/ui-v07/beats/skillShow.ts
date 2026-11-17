import type { MatchEvent, PlayerId, ShipId, V08Effect } from '../../v07/game';
import { SKILL_LABELS } from '../table/v08Text';

// V0.8 prototype (an experiment, not rules): a ship skill going off during the round's resolution, worded for the
// table. Built from the engine's public v08-effect events only. What the engine does not publish is not shown: a
// reroll's event carries no first roll, so the show says the die was rolled again, not what it was before.

/** When in the round the skill shows: with the ship's die, with its outcome, or once the market has settled. */
export type SkillAt = 'die' | 'outcome' | 'market';

export interface SkillMoment {
  readonly playerId: PlayerId;
  /** The ship the skill belongs to; null for a line that is about the player (salvage, shown at the market). */
  readonly shipId: ShipId | null;
  readonly effect: V08Effect;
  readonly at: SkillAt;
  /** The skill's name (好兆頭, 巨浪, 加注, 拾荒). */
  readonly name: string;
  /** What it did, short enough for a word over the ship. */
  readonly text: string;
  readonly tone: 'gain' | 'loss';
  /** 巨浪: what the extra die added to the roll (the die shows the roll without it until the skill goes off). */
  readonly added: number;
}

/** The ship skills that went off in `round`, in event order; a reroll that saved the ship is one moment, not two. */
export function skillMoments(events: readonly MatchEvent[], round: number): SkillMoment[] {
  const mine = events.filter((e): e is Extract<MatchEvent, { type: 'v08-effect' }> => e.type === 'v08-effect' && e.round === round);
  return mine.flatMap((e): SkillMoment[] => {
    const base = { playerId: e.playerId, shipId: e.shipId, effect: e.effect, added: 0 };
    switch (e.effect) {
      case 'reroll': {
        const saved = mine.some((o) => o.effect === 'reroll-saved' && o.shipId === e.shipId);
        return [{ ...base, at: 'die', name: SKILL_LABELS.standard, text: saved ? '重擲，逃過沉沒' : '重擲', tone: 'gain' }];
      }
      case 'extra-die':
        return [{ ...base, at: 'die', name: SKILL_LABELS.breaker, text: `再加 ${e.crates}`, tone: 'gain', added: e.crates }];
      case 'raise-won':
        return [{ ...base, at: 'outcome', name: SKILL_LABELS.gambler, text: `成功 +${e.value} G`, tone: 'gain' }];
      case 'raise-lost':
        return [{ ...base, at: 'outcome', name: SKILL_LABELS.gambler, text: '失敗', tone: 'loss' }];
      case 'salvage':
        return [{ ...base, shipId: null, at: 'market', name: SKILL_LABELS.freighter, text: `撈到 ${e.crates} 箱 +${e.value} G`, tone: 'gain' }];
      default:
        return [];
    }
  });
}
