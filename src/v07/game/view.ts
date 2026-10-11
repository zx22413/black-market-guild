import { getPendingDecisions, roleAvailable } from './decisions';
import type { Rules } from './rules';
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
  type RoleId,
  type ShipId,
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
}

/** A ship as this player sees it: cargo only for their own ship until it is resolved (§4). */
export interface ViewShip {
  readonly id: ShipId;
  readonly owner: PlayerId;
  readonly outcome: VoyageOutcome | null;
  readonly cargo: Goods | null;
}

/** What this player's intel merchant knows about one ship it looked at. */
export interface IntelKnowledge {
  readonly shipId: ShipId;
  readonly rawRoll: number;
  readonly rerolledRoll: number | null;
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
  /** Every deployment in reveal order, only after the reveal. */
  readonly revealedRoles: readonly Deployment[];
  readonly myDeployment: Deployment | null;
  /** Roles I may deploy this round under the cooldown (§9.3), regardless of cash. */
  readonly myAvailableRoles: readonly RoleId[];
  readonly intel: readonly IntelKnowledge[];
  readonly voyageDeckRemaining: number;
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
  return {
    playerId,
    rules: state.rules,
    round: state.round,
    totalRounds: state.rules.rounds,
    phase: state.phase,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      cash: p.cash,
      buildings: p.buildings,
      island: p.island,
      stock: roundState.stockAtStart[p.id] ?? p.stock,
      lastUsed: p.lastUsed,
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
      cargo: s.owner === playerId || s.outcome !== null ? s.cargo : null,
    })),
    revealedRoles: roundState.rolesRevealed ? ROLE_IDS.flatMap((role) => roundState.deployments.filter((d) => d.role === role)) : [],
    myDeployment: roundState.deployments.find((d) => d.playerId === playerId) ?? null,
    myAvailableRoles: state.round > 0 ? ROLE_IDS.filter((role) => roleAvailable(state, me, role)) : [],
    intel: intelKnowledge(state, playerId),
    voyageDeckRemaining: state.voyageDeck.length,
    submittedPlayerIds: state.players.map((p) => p.id).filter((id) => submissions[id] !== undefined),
    mySubmission: submissions[playerId] ?? null,
    pendingDecision: getPendingDecisions(state).find((d) => d.playerId === playerId)?.phase ?? null,
    result: state.result,
  };
}

function intelKnowledge(state: MatchState, playerId: PlayerId): IntelKnowledge[] {
  const d = state.roundState.deployments.find((x) => x.playerId === playerId && x.role === 'intel');
  if (d === undefined) {
    return [];
  }
  return [d.targetShipId, d.peekShipId].flatMap((shipId) => {
    const ship = state.roundState.ships.find((s) => s.id === shipId);
    return ship === undefined ? [] : [{ shipId: ship.id, rawRoll: ship.rawRoll, rerolledRoll: ship.rerolledRoll }];
  });
}
