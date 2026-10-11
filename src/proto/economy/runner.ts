import { getEconomyLegalActions, getEconomyPending } from './decisions';
import { applyEconomyAction, createEconomyMatch } from './engine';
import type { EconomyRules } from './rules';
import type { EconomyAction, EconomyEvent, EconomyState } from './types';
import { getEconomyView, type EconomyView } from './view';

export interface EconomyDecider {
  decide(view: EconomyView, legalActions: readonly EconomyAction[]): EconomyAction;
}

export interface EconomySeat {
  readonly id: string;
  readonly name: string;
  readonly bot: EconomyDecider;
}

export interface EconomyMatchRun {
  readonly state: EconomyState;
  readonly events: readonly EconomyEvent[];
}

/** Plays a whole bot-only match synchronously; each bot sees only its own view. */
export function runEconomyMatch(seed: number, seats: readonly EconomySeat[], rules?: EconomyRules): EconomyMatchRun {
  const created = createEconomyMatch({ seed, players: seats.map(({ id, name }) => ({ id, name })), ...(rules ? { rules } : {}) });
  if (!created.ok) {
    throw new Error(created.error);
  }
  let state = created.value.state;
  const events = [...created.value.events];
  while (state.phase !== 'game-over') {
    const pending = getEconomyPending(state);
    if (pending.length === 0) {
      throw new Error(`no pending decisions in ${state.phase}`);
    }
    for (const { playerId } of pending) {
      const seat = seats.find((s) => s.id === playerId);
      if (seat === undefined) {
        throw new Error(`no seat for ${playerId}`);
      }
      const action = seat.bot.decide(getEconomyView(state, playerId), getEconomyLegalActions(state, playerId));
      const applied = applyEconomyAction(state, action);
      if (!applied.ok) {
        throw new Error(applied.error);
      }
      state = applied.value.state;
      events.push(...applied.value.events);
    }
  }
  return { state, events };
}
