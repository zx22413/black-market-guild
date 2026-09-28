import type { Action, MatchEvent, PendingDecision, PlayerView, PrivateEvent } from '../game';

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
  /** Optional: public events, e.g. to remember who betrayed whom. */
  onEvents?(events: readonly MatchEvent[]): void;
  /** Optional: private events addressed to this bot's seat. */
  onPrivateEvent?(event: PrivateEvent): void;
}
