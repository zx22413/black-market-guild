import type { Action, PendingDecision, PlayerView } from '../game';

/**
 * Everything a bot may use to decide: the player's own view and the legal actions the
 * match runner computed for it. Bots never see MatchState.
 */
export interface DecisionContext {
  readonly view: PlayerView;
  readonly decision: PendingDecision;
  readonly legalActions: readonly Action[];
}

export interface Bot {
  decide(context: DecisionContext): Action;
}
