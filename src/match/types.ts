import type { Bot, BotStrategy, DecisionContext } from '../bots';
import type {
  Action,
  MatchEvent,
  MatchResult,
  MatchState,
  PlayerId,
  PrivateEvent,
  Rules,
} from '../game';

/** Who sits in a seat (docs/architecture.md §5.1). */
export type SeatConfig =
  | { readonly kind: 'local-human'; readonly name: string }
  | { readonly kind: 'bot'; readonly name: string; readonly strategy: BotStrategy }
  | { readonly kind: 'remote'; readonly name: string };

export interface SeatSetupInput {
  readonly seed: number;
  readonly seats: readonly SeatConfig[];
  /** Defaults to the engine's RULES_V06. */
  readonly rules?: Rules;
}

export interface MatchSetup {
  readonly seed: number;
  readonly rules?: Rules;
  readonly players: readonly { readonly id: PlayerId; readonly name: string }[];
  /** Ready-made bots for bot seats; human and remote seats must be connected by the caller. */
  readonly bots: Readonly<Record<PlayerId, Bot>>;
  readonly humanSeats: readonly PlayerId[];
  readonly remoteSeats: readonly PlayerId[];
}

/** Optional listeners shared by sync and async controllers. */
export interface EventListener {
  /** Every public event, in playback order. */
  onEvents?(events: readonly MatchEvent[]): void;
  /** Private events addressed to this seat only. */
  onPrivateEvent?(event: PrivateEvent): void;
}

/** Decides for one seat; async so a UI or network seat can wait for input (docs/architecture.md §5.2). */
export interface Controller extends EventListener {
  decide(context: DecisionContext): Promise<Action>;
}

/** Synchronous controller for fast all-bot simulations. */
export interface SyncController extends EventListener {
  decide(context: DecisionContext): Action;
}

export interface MatchLog {
  /** Every accepted action in order; with the setup, enough to replay the match. */
  readonly actions: readonly Action[];
  readonly events: readonly MatchEvent[];
  readonly privateEvents: readonly PrivateEvent[];
  readonly finalState: MatchState;
  readonly result: MatchResult;
}
