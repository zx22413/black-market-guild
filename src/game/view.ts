import { getPendingDecisions } from './decisions';
import type {
  Action,
  AssetId,
  DecisionPhase,
  MarketEventId,
  MatchResult,
  MatchState,
  Phase,
  PlayerId,
  PublicShip,
  VoyageEventId,
} from './types';

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
  readonly round: number;
  readonly totalRounds: number;
  readonly phase: Phase;
  readonly players: readonly PublicPlayer[];
  readonly marketEvent: MarketEventId;
  readonly voyageEvent: VoyageEventId | null;
  /** This round's ships with owners and resolved outcomes; dice values stay hidden. */
  readonly ships: readonly PublicShip[];
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
    round: state.round,
    totalRounds: state.rules.rounds,
    phase: state.phase,
    players: state.players.map(({ id, name, cash, assets }) => ({ id, name, cash, assets })),
    marketEvent: state.roundState.marketEvent,
    voyageEvent: state.roundState.voyageEvent,
    ships: state.roundState.ships.map(({ id, kind, owners, outcome }) => ({ id, kind, owners, outcome })),
    marketDeckRemaining: state.marketDeck.length,
    voyageDeckRemaining: state.voyageDeck.length,
    submittedPlayerIds: state.players.map((p) => p.id).filter((id) => submissions[id] !== undefined),
    mySubmission: submissions[playerId] ?? null,
    pendingDecision: getPendingDecisions(state).find((d) => d.playerId === playerId)?.phase ?? null,
    result: state.result,
  };
}
