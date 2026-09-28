import { getPendingDecisions } from './decisions';
import type { Rules } from './rules';
import { ROLE_IDS } from './types';
import type {
  Action,
  Deployment,
  AssetId,
  DecisionPhase,
  MarketEventId,
  MatchResult,
  MatchState,
  Phase,
  PlayerId,
  PublicShip,
  RecruitmentInfo,
  ShipId,
  VoyageEventId,
} from './types';

/** What this player's intel merchant knows about its target ship. */
export interface IntelKnowledge {
  readonly shipId: ShipId;
  readonly rawRoll: number;
  readonly rerolledRoll: number | null;
}

export interface PublicPlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly cash: number;
  readonly assets: readonly AssetId[];
}

/**
 * Everything one player is allowed to know (game-design.md §4).
 * UI and bots must render and decide from this view only, never from MatchState.
 */
export interface PlayerView {
  readonly playerId: PlayerId;
  /** Rule numbers are public knowledge (costs, prices, modifiers). */
  readonly rules: Rules;
  readonly round: number;
  readonly totalRounds: number;
  readonly phase: Phase;
  readonly players: readonly PublicPlayer[];
  readonly marketEvent: MarketEventId;
  readonly voyageEvent: VoyageEventId | null;
  /** This round's resolved recruiting, applications and ventures (public once each phase closes). */
  readonly recruitment: RecruitmentInfo;
  /** This round's ships with owners and resolved outcomes; dice values stay hidden. */
  readonly ships: readonly PublicShip[];
  /** Every role and target in action order, but only after the reveal (game-design.md §5 step 5). */
  readonly revealedRoles: readonly Deployment[];
  /** This player's own locked deployment, visible to them from lock time. */
  readonly myDeployment: Deployment | null;
  /** Raw (and rerolled) value of the ship this player's intel merchant targets. */
  readonly intel: IntelKnowledge | null;
  readonly marketDeckRemaining: number;
  readonly voyageDeckRemaining: number;
  /** Players who already submitted in the current phase; their choices stay hidden. */
  readonly submittedPlayerIds: readonly PlayerId[];
  readonly mySubmission: Action | null;
  readonly pendingDecision: DecisionPhase | null;
  readonly result: MatchResult | null;
}

export function getPlayerView(state: MatchState, playerId: PlayerId): PlayerView {
  if (!state.players.some((p) => p.id === playerId)) {
    throw new Error(`unknown player: ${playerId}`);
  }
  const { submissions } = state.roundState;
  return {
    playerId,
    rules: state.rules,
    round: state.round,
    totalRounds: state.rules.rounds,
    phase: state.phase,
    players: state.players.map(({ id, name, cash, assets }) => ({ id, name, cash, assets })),
    marketEvent: state.roundState.marketEvent,
    voyageEvent: state.roundState.voyageEvent,
    recruitment: state.roundState.recruitment,
    ships: state.roundState.ships.map(({ id, kind, owners, outcome }) => ({ id, kind, owners, outcome })),
    revealedRoles: state.roundState.rolesRevealed
      ? ROLE_IDS.flatMap((role) => state.roundState.deployments.filter((d) => d.role === role))
      : [],
    myDeployment: state.roundState.deployments.find((d) => d.playerId === playerId) ?? null,
    intel: intelKnowledge(state, playerId),
    marketDeckRemaining: state.marketDeck.length,
    voyageDeckRemaining: state.voyageDeck.length,
    submittedPlayerIds: state.players.map((p) => p.id).filter((id) => submissions[id] !== undefined),
    mySubmission: submissions[playerId] ?? null,
    pendingDecision: getPendingDecisions(state).find((d) => d.playerId === playerId)?.phase ?? null,
    result: state.result,
  };
}

function intelKnowledge(state: MatchState, playerId: PlayerId): IntelKnowledge | null {
  const deployment = state.roundState.deployments.find((d) => d.playerId === playerId && d.role === 'intel');
  const ship = state.roundState.ships.find((s) => s.id === deployment?.targetShipId);
  if (ship === undefined || ship.rawRoll === null) {
    return null;
  }
  return { shipId: ship.id, rawRoll: ship.rawRoll, rerolledRoll: ship.rerolledRoll };
}
