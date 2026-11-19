import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { GOODS, type Goods, type MatchEvent, type PlayerId, type Rules, type TideKind } from '../../v07/game';
import { seatPosition } from '../../ui/scene/layout';
import { soundEngine } from '../audio/soundEngine';
import type { TablePin } from '../scene/TableCanvas';
import { TideSweep } from '../scene/TideSweep';
import { TIDE_WATER, mixHex } from '../scene/tideLook';
import { buildBoard } from '../session/board';
import { GoodIcon } from './GoodIcon';
import { WaveIcon } from './icons';
import { SWEEP, sweepMs, tideSweeps, type TideSweepLoss } from './tideSweepShow';

// V0.8 prototype (rules.v08.events, an experiment, not rules): once the 「暗潮將至」 round is over, the table shows the
// tide taking the warehouses' goods (scene/TideSweep.tsx) before anything of the next round comes up: the round's
// card, the islands' moments and the decision all wait for it. Over each island a label counts the warehouse down.

/** How high over an island its label hangs (same as the islands' moments). */
const LABEL_HEIGHT = 7;
/** The water that comes up when no tide kind is in the match. */
export const PLAIN_TIDE_WATER = '#123c48';
const NO_GOODS: Goods = { wood: 0, iron: 0, spice: 0, arms: 0 };
const NONE: readonly TideSweepLoss[] = [];

export interface TideSweepInput {
  /** Every public event so far (the loss is read from the round before `round`). */
  readonly events: readonly MatchEvent[];
  /** The round the table is in. */
  readonly round: number;
  /** The table may show it now (loaded, no round being replayed). */
  readonly free: boolean;
  readonly angleOf: (id: PlayerId) => number;
  readonly ids: readonly PlayerId[];
  readonly startingCash: number;
  readonly rules: Rules;
  /** The match's tide, for the water's colour. */
  readonly tide: TideKind | null;
}

export interface TideSweepShow {
  /** The show is on: the next card, moment and decision wait. */
  readonly blocking: boolean;
  readonly pins: readonly TablePin[];
  readonly scene: ReactNode;
  /**
   * What the seats' plates show while the show is on (null otherwise): the warehouses as the tide found them, then, once
   * the labels count down, what it left. The new round's production is not in it yet, so a plate never contradicts its
   * island's label; the plates take the round's own stock again when the show is over.
   */
  readonly stock: Readonly<Record<PlayerId, Goods>> | null;
}

const IDLE: TideSweepShow = { blocking: false, pins: [], scene: null, stock: null };

export function useTideSweep({ events, round, free, angleOf, ids, startingCash, rules, tide }: TideSweepInput): TideSweepShow {
  const found = useMemo(() => {
    const at = events.findIndex((e) => e.type === 'dark-tide-loss' && e.round === round - 1);
    if (at < 0) return null;
    // The warehouses just before the tide came: the board as of the events ahead of the loss.
    const before = buildBoard(ids, startingCash, events.slice(0, at), rules);
    return { losses: tideSweeps(events, round, (id) => before.players[id]?.stock ?? NO_GOODS), before: Object.fromEntries(ids.map((id) => [id, before.players[id]?.stock ?? NO_GOODS])) };
  }, [events, round, ids, startingCash, rules]);
  const [shownRound, setShownRound] = useState(0);
  // The labels have counted down (the plates follow them).
  const [countedRound, setCountedRound] = useState(0);
  const sweeps = found?.losses ?? NONE;
  const on = free && sweeps.length > 0 && shownRound < round;
  const ms = sweepMs(sweeps);
  useEffect(() => {
    if (!on) return undefined;
    // The wave breaks low over the islands, then the crates go under.
    soundEngine.playSfx('salute-splash', 0.55);
    const timers = [
      setTimeout(() => soundEngine.playSfx('salute-splash', 0.8), (SWEEP.surge * 0.6 + SWEEP.drift) * 1000),
      setTimeout(() => setCountedRound(round), SWEEP.surge * 1000),
      setTimeout(() => setShownRound(round), ms),
    ];
    return () => timers.forEach(clearTimeout);
  }, [on, round, ms]);

  if (!on || !found) return IDLE;
  const counted = countedRound >= round;
  return {
    blocking: true,
    stock: Object.fromEntries(
      Object.entries(found.before).map(([id, stock]) => {
        const lost = counted ? sweeps.find((s) => s.playerId === id)?.lost : undefined;
        return [id, lost ? (Object.fromEntries(GOODS.map((g) => [g, stock[g] - lost[g]])) as Goods) : stock];
      }),
    ),
    scene: <TideSweep key={`tide-sweep-${round}`} islands={sweeps.map((s) => ({ angle: angleOf(s.playerId), crates: s.crates }))} water={tide ? mixHex(TIDE_WATER[tide], '#58c7c0', 0.25) : PLAIN_TIDE_WATER} />,
    pins: sweeps.map((s): TablePin => {
      const [x, , z] = seatPosition(angleOf(s.playerId));
      return {
        id: `tide-sweep-${round}-${s.playerId}`,
        position: [x, LABEL_HEIGHT, z],
        clamp: true,
        node: (
          <span className="isle-moment loss tide-sweep-label">
            <span className="isle-chip tide-sweep-chip">
              <WaveIcon />
              暗潮捲走
            </span>
            {GOODS.filter((g) => s.lost[g] > 0).map((g, i) => (
              <span key={g} className="isle-chip tide-sweep-chip" title={`倉庫的貨被暗潮捲走 ${s.lost[g]} 箱`} style={{ animationDelay: `${Math.round(SWEEP.surge * 1000) + i * 160}ms` }}>
                <GoodIcon good={g} size="md" />
                {s.before[g]}
                <i aria-hidden="true">→</i>
                <b>{s.before[g] - s.lost[g]}</b>
              </span>
            ))}
          </span>
        ),
      };
    }),
  };
}
