import { useEffect, useState } from 'react';
import type { IslandId, PlayerId, ShipId } from '../../v07/game';
import type { Vec3 } from '../../ui/scene/layout';
import type { HumanRequest } from '../session/gameSession';
import { PEEK_PACE, peekSpotlight, shipPoint, type SpotlightCue } from '../scene/spotlightMath';

// The lighthouse intel's private look on the table (docs/game-design.md §11.2), seen only by its
// own player: before the reroll card comes up, the table goes dark and the lighthouse's beams fall
// on the ships it looked at. Picking a ship to reroll puts the card aside while the beams close onto
// that ship, then the card returns with the die tumbling. Other islands go straight to the card.

export interface PeekInput {
  /** The open reroll decision on screen, or null. */
  readonly request: HumanRequest | null;
  /** The ship picked for a reroll, once picked (the card then shows the new die). */
  readonly rerolledShip: ShipId | null;
  readonly islandOf: (id: PlayerId) => IslandId | null;
  readonly angleOf: (id: PlayerId) => number;
  /** Where each looked-at ship sits right now (its owner's lane, at the dock or at sea). */
  readonly shipAt: (shipId: ShipId) => Vec3 | null;
}

export interface Peek {
  readonly cue: SpotlightCue | null;
  /** The reroll card shows (not while the beams are swinging in or closing). */
  readonly cardShown: boolean;
}

type Phase = 'look' | 'card' | 'close' | 'rolled';

export function usePeekSpotlight({ request, rerolledShip, islandOf, angleOf, shipAt }: PeekInput): Peek {
  const playerId = request?.context.decision.playerId ?? null;
  const looked = request?.context.view.intel.map((k) => k.shipId) ?? [];
  const points = looked.map(shipAt).filter((p): p is Vec3 => p !== null);
  const key = request ? `peek-${request.id}` : 'peek';
  const rerolled = rerolledShip === null ? null : looked.indexOf(rerolledShip);
  const base = playerId === null || points.length !== looked.length ? null : peekSpotlight(key, islandOf(playerId), angleOf(playerId), points, null);
  const lit = base !== null;

  const [phase, setPhase] = useState<Phase>('look');
  useEffect(() => setPhase('look'), [key]);
  useEffect(() => {
    if (rerolledShip !== null) setPhase('close');
  }, [rerolledShip]);
  useEffect(() => {
    if (!lit || (phase !== 'look' && phase !== 'close')) return undefined;
    const timer = setTimeout(() => setPhase(phase === 'look' ? 'card' : 'rolled'), phase === 'look' ? PEEK_PACE.intro : PEEK_PACE.close);
    return () => clearTimeout(timer);
  }, [lit, phase]);

  if (!base || playerId === null) return { cue: null, cardShown: true };
  const closing = rerolled !== null && rerolled >= 0 && (phase === 'close' || phase === 'rolled');
  return {
    cue: closing ? peekSpotlight(key, islandOf(playerId), angleOf(playerId), points, rerolled) : base,
    cardShown: phase === 'card' || phase === 'rolled',
  };
}

/** A ship's spot on the table from its owner's lane, for `usePeekSpotlight`. */
export function lanePoint(owner: PlayerId | undefined, angleOf: (id: PlayerId) => number, state: 'docked' | 'sailing'): Vec3 | null {
  return owner === undefined ? null : shipPoint(angleOf(owner), state);
}
