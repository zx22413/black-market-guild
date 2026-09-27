import type { CashReason, MatchEvent, MatchState, PlayerId, ShipId, Step } from './types';

/**
 * Adds `amount` (negative to charge) to a player's cash and emits the public event.
 * Legal-action checks must guarantee affordability; going negative is an engine bug.
 */
export function changeCash(
  state: MatchState,
  playerId: PlayerId,
  amount: number,
  reason: CashReason,
  shipId: ShipId | null,
): Step {
  const player = state.players.find((p) => p.id === playerId);
  if (player === undefined) {
    throw new Error(`unknown player: ${playerId}`);
  }
  if (player.cash + amount < 0) {
    throw new Error(`${playerId} cannot afford ${-amount} G for ${reason}`);
  }
  const event: MatchEvent = { type: 'cash-changed', round: state.round, playerId, amount, reason, shipId };
  return {
    state: {
      ...state,
      players: state.players.map((p) => (p.id === playerId ? { ...p, cash: p.cash + amount } : p)),
    },
    events: [event],
  };
}

/** Applies a sequence of state steps, collecting their events in order. */
export function chain(
  state: MatchState,
  steps: readonly ((current: MatchState) => Step)[],
): Step {
  return steps.reduce<Step>(
    (acc, step) => {
      const next = step(acc.state);
      return {
        state: next.state,
        events: [...acc.events, ...next.events],
        privateEvents: [...(acc.privateEvents ?? []), ...(next.privateEvents ?? [])],
      };
    },
    { state, events: [], privateEvents: [] },
  );
}
