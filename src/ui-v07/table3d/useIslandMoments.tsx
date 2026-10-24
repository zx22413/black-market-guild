import { useEffect, useMemo, useState } from 'react';
import { RULES_V07, type IslandId, type MatchEvent, type PlayerId } from '../../v07/game';
import { seatPosition } from '../../ui/scene/layout';
import { soundEngine } from '../audio/soundEngine';
import type { TablePin } from '../scene/TableCanvas';
import type { Board } from '../session/board';
import { slowed } from '../scene/showTempo';
import { GoodIcon } from './GoodIcon';
import { launchMoments, openingMoments, type IslandMoment } from './islandMoments';

// When the islands that change production or costs get their moment on the table (see
// `islandMoments`): at each round's start, before the investment, and at the launch, before the
// roles are deployed. Each holds the table for a moment (the next decision waits), then lets go.

/** How long each moment holds the table (ms): long enough to read the chips once. */
export const MOMENT_MS = slowed({ opening: 2600, launch: 2200 });
/** How high over an island its chips hang. */
const CHIP_HEIGHT = 7;

export interface MomentsInput {
  readonly events: readonly MatchEvent[];
  readonly board: Board;
  /** The table may show a moment now (loaded, no round being replayed, no full-screen card). */
  readonly free: boolean;
  readonly angleOf: (id: PlayerId) => number;
  /** Leave out the opening moments of round 1 (the tutorial's welcome should not wait for them). */
  readonly skipFirstOpening?: boolean;
  /** Leave out every moment (a tutorial lesson that does not mention the islands plays without them). */
  readonly skip?: boolean;
}

export interface Moments {
  /** A moment is on: the next decision waits. */
  readonly blocking: boolean;
  readonly pins: readonly TablePin[];
  readonly pulses: ReadonlyMap<PlayerId, { readonly key: string; readonly tone: 'gain' | 'loss' }>;
}

const NONE: ReadonlyMap<PlayerId, { readonly key: string; readonly tone: 'gain' | 'loss' }> = new Map();


/** When a notice's chip `i` pops up (its sound waits the same). */
const chipDelay = (i: number): number => 300 + i * 160;
/** A cost's chip pops lower than a gain's. */
const LOSS_PITCH = 0.82;

export function useIslandMoments({ events, board, free, angleOf, skipFirstOpening = false, skip = false }: MomentsInput): Moments {
  const round = board.round;
  const islands = useMemo((): Readonly<Record<PlayerId, IslandId>> | null => {
    const chosen = events.find((e) => e.type === 'islands-chosen');
    return chosen?.type === 'islands-chosen' ? chosen.islands : null;
  }, [events]);
  const opening = useMemo(() => {
    if (!islands || round < 1 || (skipFirstOpening && round === 1)) return [];
    const produced = events.find((e) => e.type === 'goods-produced' && e.round === round);
    const made = (id: PlayerId) => (produced?.type === 'goods-produced' ? (produced.produced[id]?.spice ?? 0) : 0);
    return openingMoments(islands, round, RULES_V07, (id) => Math.max(0, (board.players[id]?.stock.spice ?? 0) - made(id)));
    // The carried spice is read once per round, from the stock at the round's start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [islands, round]);
  const launched = events.find((e) => e.type === 'ships-launched' && e.round === round);
  const launch = useMemo(
    () => (islands && launched?.type === 'ships-launched' ? launchMoments(islands, launched.ships.map((s) => s.owner), RULES_V07) : []),
    [islands, launched],
  );

  const [openedRound, setOpenedRound] = useState(0);
  const [launchedRound, setLaunchedRound] = useState(0);
  const phase: 'opening' | 'launch' | null =
    skip || !free || round < 1 ? null : openedRound < round ? 'opening' : launched && launchedRound < round ? 'launch' : null;
  const shown: readonly IslandMoment[] = phase === 'opening' ? opening : phase === 'launch' ? launch : [];

  useEffect(() => {
    if (phase === null) return undefined;
    const done = () => (phase === 'opening' ? setOpenedRound(round) : setLaunchedRound(round));
    if (shown.length === 0) {
      done();
      return undefined;
    }
    const timer = setTimeout(done, MOMENT_MS[phase]);
    return () => clearTimeout(timer);
  }, [phase, round, shown.length]);

  // Each notice chip pops up with a low bubble as it shows: lower still for a cost. Islands showing
  // at once share the pops (one per chip slot, a gain if any island's chip there is one).
  useEffect(() => {
    if (phase === null) return undefined;
    const slots = Math.max(0, ...shown.map((m) => m.chips.length));
    const timers = Array.from({ length: slots }, (_, i) => {
      const gain = shown.some((m) => m.chips[i]?.tone === 'gain');
      return setTimeout(() => soundEngine.playSfx('island-pop', gain ? 1 : LOSS_PITCH), chipDelay(i));
    });
    return () => timers.forEach(clearTimeout);
    // Once per phase of a round; `shown` is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  if (phase === null || shown.length === 0) return { blocking: phase !== null, pins: [], pulses: NONE };
  return {
    blocking: true,
    pulses: new Map(shown.map((m) => [m.playerId, { key: `${phase}-${round}-${m.playerId}`, tone: m.tone }])),
    pins: shown.map((m): TablePin => {
      const [x, , z] = seatPosition(angleOf(m.playerId));
      return {
        id: `moment-${phase}-${round}-${m.playerId}`,
        position: [x, CHIP_HEIGHT, z],
        node: (
          <span className={`isle-moment ${m.tone}`}>
            {m.chips.map((c, i) => (
              <span key={i} className={`isle-chip ${c.tone}`} title={c.title} style={{ animationDelay: `${chipDelay(i)}ms` }}>
                {c.good && <GoodIcon good={c.good} size="md" />}
                {c.text}
              </span>
            ))}
          </span>
        ),
      };
    }),
  };
}
