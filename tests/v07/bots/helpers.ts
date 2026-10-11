import type { Action, MatchEvent, MatchState, PrivateEvent } from '../../../src/v07/game';
import type { Bot } from '../../../src/v07/bots';
import { runMatchSync } from '../../../src/v07/match';

export interface BotMatch {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
  readonly privateEvents: readonly PrivateEvent[];
  readonly actions: readonly Action[];
}

/** Plays a whole match through the match runner with the given bots in seats p1..pN. */
export function playBots(seed: number, bots: readonly Bot[]): BotMatch {
  const players = bots.map((_, i) => ({ id: `p${i + 1}`, name: `p${i + 1}` }));
  const controllers = Object.fromEntries(bots.map((bot, i) => [players[i]!.id, bot]));
  const log = runMatchSync({ seed, players, bots: controllers, humanSeats: [], remoteSeats: [] }, controllers);
  return { state: log.finalState, events: log.events, privateEvents: log.privateEvents, actions: log.actions };
}
