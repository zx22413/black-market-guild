import { getPendingDecisions, roleAvailable } from './decisions';
import type { Rules } from './rules';
import { eventsOn, publicEvents } from './v08-events';
import {
  ROLE_IDS,
  type Action,
  type BuildingId,
  type DecisionPhase,
  type Deployment,
  type Goods,
  type IslandId,
  type MatchResult,
  type MatchState,
  type Phase,
  type PlayerId,
  type PublicEvents,
  type RoleId,
  type ShipId,
  type ShipTypeId,
  type V08BuildingId,
  type VoyageEventId,
  type VoyageOutcome,
} from './types';

export interface PublicPlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly cash: number;
  readonly buildings: readonly BuildingId[];
  readonly island: IslandId | null;
  /** Warehouse after this round's production, before loading (§4). */
  readonly stock: Goods;
  /** Round each role was last deployed; public through the role reveals (§9.3). */
  readonly lastUsed: Readonly<Partial<Record<RoleId, number>>>;
  /** Experiment (rules.ships): round each ship type was last launched; ship types are public once launched (§4). */
  readonly lastShip: Readonly<Partial<Record<ShipTypeId, number>>>;
  /** V0.8 prototype: opened ship skills and the building (public when taken). */
  readonly skills?: Readonly<Partial<Record<ShipTypeId, number>>>;
  /** V0.8 prototype (v08.levelUp): launches since opening, public like the launches themselves. */
  readonly practice?: Readonly<Partial<Record<ShipTypeId, number>>>;
  readonly facility?: V08BuildingId;
  /** V0.8 prototype (v08.armory.counterCharges): counterattacks made so far, public like the counterattacks. */
  readonly counterUsed?: number;
}

/** A ship as this player sees it: cargo only for their own ship until it is resolved (§4). */
export interface ViewShip {
  readonly id: ShipId;
  readonly owner: PlayerId;
  readonly outcome: VoyageOutcome | null;
  /** The ship type is public once the ships are launched (§4). */
  readonly type: ShipTypeId;
  readonly cargo: Goods | null;
  /** V0.8 prototype: a raised gambler (public), and the hidden ship's private crates (owner only until resolved). */
  readonly raised?: true;
  readonly privateCargo?: Goods;
}

/**
 * Everything one player is allowed to know (§4). UI and bots must render and decide from this
 * view only, never from MatchState.
 */
export interface PlayerView {
  readonly playerId: PlayerId;
  /** Rule numbers are public knowledge. */
  readonly rules: Rules;
  readonly round: number;
  readonly totalRounds: number;
  readonly phase: Phase;
  readonly players: readonly PublicPlayer[];
  /** My current warehouse, including goods kept or salvaged this round. */
  readonly myStock: Goods;
  /** Islands I may choose from during the draft (§11.1). */
  readonly myIslandOffers: readonly IslandId[];
  readonly prices: Goods;
  readonly demand: Goods;
  readonly wanted: readonly PlayerId[];
  readonly voyageEvent: VoyageEventId | null;
  readonly ships: readonly ViewShip[];
  /** Experiment (rules.ships): ships still at sea, public (owner and type); their cargo is secret even from their owner's view here. */
  readonly transit: readonly { readonly id: ShipId; readonly owner: PlayerId; readonly type: ShipTypeId; readonly arriveRound: number }[];
  /** Every deployment in reveal order, only after the reveal. */
  readonly revealedRoles: readonly Deployment[];
  readonly myDeployment: Deployment | null;
  /** Roles I may deploy this round under the cooldown (§9.3), regardless of cash. */
  readonly myAvailableRoles: readonly RoleId[];
  readonly voyageDeckRemaining: number;
  /** V0.8 prototype (v08.events): phase, advances drawn, the final round and its effect; absent when the switch is off. */
  readonly events?: PublicEvents;
  /** Players who already submitted in the current phase; their choices stay hidden. */
  readonly submittedPlayerIds: readonly PlayerId[];
  readonly mySubmission: Action | null;
  readonly pendingDecision: DecisionPhase | null;
  readonly result: MatchResult | null;
}

export function getPlayerView(state: MatchState, playerId: PlayerId): PlayerView {
  const me = state.players.find((p) => p.id === playerId);
  if (me === undefined) {
    throw new Error(`unknown player: ${playerId}`);
  }
  const { roundState } = state;
  const { submissions } = roundState;
  const events = publicEvents(state);
  return {
    playerId,
    rules: state.rules,
    round: state.round,
    // V0.8 prototype (v08.events): the known final round, else the round cap.
    totalRounds: eventsOn(state.rules) ? (state.v08Events?.finalRound ?? state.rules.v08.events.maxRounds) : state.rules.rounds,
    phase: state.phase,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      cash: p.cash,
      buildings: p.buildings,
      island: p.island,
      stock: roundState.stockAtStart[p.id] ?? p.stock,
      lastUsed: p.lastUsed,
      lastShip: p.lastShip,
      ...(p.skills === undefined ? {} : { skills: p.skills }),
      ...(p.practice === undefined ? {} : { practice: p.practice }),
      ...(p.facility === undefined ? {} : { facility: p.facility }),
      ...(p.counterUsed === undefined ? {} : { counterUsed: p.counterUsed }),
    })),
    myStock: me.stock,
    myIslandOffers: state.islandOffers[playerId] ?? [],
    prices: state.prices,
    demand: roundState.demand,
    wanted: roundState.wanted,
    voyageEvent: roundState.voyageEvent,
    ships: roundState.ships.map((s) => ({
      id: s.id,
      owner: s.owner,
      outcome: s.outcome,
      type: s.type,
      cargo: s.owner === playerId || s.outcome !== null ? s.cargo : null,
      ...(s.raised === true ? { raised: true as const } : {}),
      ...(s.privateCargo !== undefined && (s.owner === playerId || s.outcome !== null) ? { privateCargo: s.privateCargo } : {}),
    })),
    transit: state.transit.map((s) => ({ id: s.id, owner: s.owner, type: s.type, arriveRound: s.arriveRound })),
    revealedRoles: roundState.rolesRevealed ? ROLE_IDS.flatMap((role) => roundState.deployments.filter((d) => d.role === role)) : [],
    myDeployment: roundState.deployments.find((d) => d.playerId === playerId) ?? null,
    myAvailableRoles: state.round > 0 ? ROLE_IDS.filter((role) => roleAvailable(state, me, role)) : [],
    voyageDeckRemaining: state.v08Events?.deck.length ?? state.voyageDeck.length,
    ...(events === undefined ? {} : { events }),
    submittedPlayerIds: state.players.map((p) => p.id).filter((id) => submissions[id] !== undefined),
    mySubmission: submissions[playerId] ?? null,
    pendingDecision: getPendingDecisions(state).find((d) => d.playerId === playerId)?.phase ?? null,
    result: state.result,
  };
}
