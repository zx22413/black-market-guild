import { GOODS, type GoodId, type Goods, type MatchEvent, type PlayerId } from '../../v07/game';

// V0.8 prototype (rules.v08.events, an experiment, not rules): what 「暗潮將至」 took from the warehouses, as the table
// plays it once that round is over: the water comes up over each island that lost goods and carries the crates out to
// sea. Plain data from the public `dark-tide-loss` event; the scene (scene/TideSweep.tsx) and the labels read it.

/** How long the show holds the table (seconds): the surge, the crates drifting out, then going under. */
export const SWEEP = { surge: 0.9, drift: 2.1, sink: 0.7, stagger: 0.14, hold: 0.9 } as const;
/** No island floats more crates than this (a big warehouse's loss still reads as one wave of crates). */
export const SWEEP_MAX_CRATES = 8;

export interface TideSweepLoss {
  readonly playerId: PlayerId;
  /** What the tide took, per good. */
  readonly lost: Goods;
  /** The warehouse just before the tide came. */
  readonly before: Goods;
  /** One entry per crate the scene floats away, in the goods' order (at most SWEEP_MAX_CRATES). */
  readonly crates: readonly GoodId[];
}

/** The crates the scene shows for a loss: one per unit, the goods taking turns so a capped row still shows every good lost. */
export function sweepCrates(lost: Goods): GoodId[] {
  const left = { ...lost };
  const crates: GoodId[] = [];
  while (crates.length < SWEEP_MAX_CRATES) {
    const round = GOODS.filter((g) => left[g] > 0);
    if (round.length === 0) break;
    for (const g of round) {
      if (crates.length >= SWEEP_MAX_CRATES) break;
      crates.push(g);
      left[g] -= 1;
    }
  }
  return crates;
}

/**
 * The warehouses 「暗潮將至」 emptied at the end of the round before `round` (shown as that round is over, before `round`
 * begins). `before` gives a seat's warehouse just before the loss. Seats that lost nothing are left out.
 */
export function tideSweeps(events: readonly MatchEvent[], round: number, before: (id: PlayerId) => Goods): TideSweepLoss[] {
  return events.flatMap((e): TideSweepLoss[] => {
    if (e.type !== 'dark-tide-loss' || e.round !== round - 1) return [];
    return Object.entries(e.lost).flatMap(([playerId, lost]): TideSweepLoss[] =>
      GOODS.some((g) => lost[g] > 0) ? [{ playerId, lost, before: before(playerId), crates: sweepCrates(lost) }] : [],
    );
  });
}

/** How long the whole show takes for `sweeps` (ms), the longest row of crates included. */
export function sweepMs(sweeps: readonly TideSweepLoss[]): number {
  const most = Math.max(0, ...sweeps.map((s) => s.crates.length));
  return Math.round((SWEEP.surge + Math.max(0, most - 1) * SWEEP.stagger + SWEEP.drift + SWEEP.sink + SWEEP.hold) * 1000);
}

/** Where crate `i` of `count` is at `t` seconds into the show, along its way out to sea (0 on the island, 1 where it sinks). */
export interface CrateFrame {
  /** Not yet lifted or already gone under. */
  readonly visible: boolean;
  /** 0–1 along the way from the warehouse out to sea. */
  readonly along: number;
  /** 0–1: how far the water has lifted it off the ground (falls back as the water goes down). */
  readonly lift: number;
  /** 0–1: how far it has gone under. */
  readonly under: number;
}

export function crateFrame(t: number, i: number): CrateFrame {
  const local = t - SWEEP.surge * 0.6 - i * SWEEP.stagger;
  if (local < 0) return { visible: true, along: 0, lift: 0, under: 0 };
  const k = Math.min(1, local / SWEEP.drift);
  const under = Math.min(1, Math.max(0, local - SWEEP.drift) / SWEEP.sink);
  // Eased out: the wave snatches the crate, then it slows on open water.
  return { visible: under < 1, along: 1 - (1 - k) ** 2, lift: Math.sin(Math.min(1, k * 2.5) * (Math.PI / 2)), under };
}
