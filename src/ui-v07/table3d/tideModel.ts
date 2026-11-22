import type { MatchEvent, Rules, TideKind } from '../../v07/game';

// V0.8 prototype (rules.v08.events, an experiment, not rules): what the table knows about the dark tide, rebuilt from
// public events only. The two candidates are public from the start and stay in view (a threat known in advance has
// to stay on screen: docs/proposals/2026-11-similar-games-comparison.md §2), then the one that was picked.

export interface TideStatus {
  /** The two candidate kinds; empty when the match has no tides. */
  readonly candidates: readonly TideKind[];
  /** The tide picked when 暗潮將至 was revealed; null before. */
  readonly tide: TideKind | null;
  /** The round 暗潮將至 was revealed in (the tide acts from the round after); null before. */
  readonly risingRound: number | null;
  /** The last round, once it is known; null before. */
  readonly finalRound: number | null;
}

export function tideStatus(events: readonly MatchEvent[]): TideStatus {
  let status: TideStatus = { candidates: [], tide: null, risingRound: null, finalRound: null };
  for (const e of events) {
    if (e.type === 'tide-candidates') status = { ...status, candidates: e.candidates };
    else if (e.type === 'tide-revealed') status = { ...status, tide: e.tide };
    else if (e.type === 'dark-tide-rising') status = { ...status, risingRound: e.round };
    else if (e.type === 'final-round') status = { ...status, finalRound: e.round };
  }
  return status;
}

export const TIDE_LABELS: Readonly<Record<TideKind, string>> = { storm: '風暴潮', pirate: '海盜潮', inspection: '查緝潮', crash: '崩盤潮' };

/** What stops each tide for its owner (the prototype's buildings; the inspection tide is stopped by cover). */
export const TIDE_SHIELD: Readonly<Record<TideKind, string>> = { storm: '修船廠', pirate: '軍械庫', inspection: '掩護（走私商人、幽靈號技能）', crash: '商行' };

/** A tide's effect in every round it acts, with the numbers of `rules` (never written out by hand). */
export function tideText(rules: Rules, tide: TideKind): string {
  const e = rules.v08.events;
  switch (tide) {
    case 'storm':
      return `最終值 ${e.tideStormLossFrom}～${e.tideStormLossTo} 的船多掉 ${e.tideStormExtraLoss} 箱`;
    case 'pirate':
      return e.tidePirateArrivalCrates > 0
        ? `被海盜鎖定的船就算到港，也被搶走最貴的 ${e.tidePirateArrivalCrates} 箱`
        : `被海盜鎖定的船就算到港，也被搶 ${e.tidePirateArrivalLoot}%`;
    case 'inspection':
      return `需求以內的軍火也查扣 ${-e.tideInspection} 箱`;
    case 'crash':
      return `跌價一次跌 ${e.tideDropMultiplier} 格`;
  }
}

/** The round label of the HUD: the prototype's match has no fixed length, so no 「／6」; the last round says so. */
export function roundLabel(round: number, totalRounds: number, status: TideStatus, openEnded: boolean): string {
  if (round === 0) return '選島';
  if (!openEnded) return `第 ${round}／${totalRounds} 回合`;
  return status.finalRound === round ? `第 ${round} 回合・最後一回合` : `第 ${round} 回合`;
}
