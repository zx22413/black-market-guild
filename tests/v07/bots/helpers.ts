import {
  applyAction,
  createMatch,
  getLegalActions,
  getPendingDecisions,
  getPlayerView,
  type Action,
  type MatchEvent,
  type MatchState,
  type PrivateEvent,
} from '../../../src/v07/game';
import type { Bot } from '../../../src/v07/bots';

export interface BotMatch {
  readonly state: MatchState;
  readonly events: MatchEvent[];
  readonly privateEvents: PrivateEvent[];
  readonly actions: Action[];
}

/**
 * Minimal stand-in for the stage 3 match runner: each bot gets only its own view and the legal
 * actions, public events, and the private events addressed to its seat.
 */
export function playBots(seed: number, bots: readonly Bot[]): BotMatch {
  const ids = bots.map((_, i) => `p${i + 1}`);
  const created = createMatch({ seed, players: ids.map((id) => ({ id, name: id })) });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  let state = created.value.state;
  const events = [...created.value.events];
  const privateEvents = [...created.value.privateEvents];
  const actions: Action[] = [];
  const deliver = (pub: readonly MatchEvent[], priv: readonly PrivateEvent[]) => {
    bots.forEach((bot, i) => {
      bot.onEvents?.(pub);
      priv.filter((e) => e.playerId === ids[i]).forEach((e) => bot.onPrivateEvent?.(e));
    });
  };
  deliver(created.value.events, created.value.privateEvents);
  while (state.phase !== 'game-over') {
    const [decision] = getPendingDecisions(state);
    if (decision === undefined) {
      throw new Error(`stuck in ${state.phase}`);
    }
    const legalActions = getLegalActions(state, decision.playerId);
    const bot = bots[ids.indexOf(decision.playerId)]!;
    const action = bot.decide({ view: getPlayerView(state, decision.playerId), decision, legalActions });
    const result = applyAction(state, action);
    if (!result.ok) {
      throw new Error(`${decision.playerId}: ${result.error.message}`);
    }
    state = result.value.state;
    events.push(...result.value.events);
    privateEvents.push(...result.value.privateEvents);
    actions.push(action);
    deliver(result.value.events, result.value.privateEvents);
  }
  return { state, events, privateEvents, actions };
}
