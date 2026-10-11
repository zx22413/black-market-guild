import type { CashReason, MatchState, PlayerId, PlayerState, ShipId, Step } from './types';

export function playerOf(state: MatchState, playerId: PlayerId): PlayerState {
  const player = state.players.find((p) => p.id === playerId);
  if (player === undefined) {
    throw new Error(`unknown player: ${playerId}`);
  }
  return player;
}

export function holds(state: MatchState, playerId: PlayerId, building: PlayerState['buildings'][number]): boolean {
  return playerOf(state, playerId).buildings.includes(building);
}

export function updatePlayer(state: MatchState, playerId: PlayerId, update: (player: PlayerState) => PlayerState): MatchState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? update(p) : p)) };
}

/** Adds `amount` (negative to charge); legal-action checks must keep cash non-negative. */
export function changeCash(state: MatchState, playerId: PlayerId, amount: number, reason: CashReason, shipId: ShipId | null): Step {
  const player = playerOf(state, playerId);
  if (player.cash + amount < 0) {
    throw new Error(`${playerId} cannot afford ${-amount} G for ${reason}`);
  }
  return {
    state: updatePlayer(state, playerId, (p) => ({ ...p, cash: p.cash + amount })),
    events: [{ type: 'cash-changed', round: state.round, playerId, amount, reason, shipId }],
  };
}

export type StepFn = (state: MatchState) => Step;

/** Applies steps in order, collecting public and private events. */
export function chain(state: MatchState, steps: readonly StepFn[]): Step {
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

/** Pays positive amounts only. */
export function payAll(
  payments: readonly { readonly playerId: PlayerId; readonly amount: number }[],
  reason: CashReason,
  shipId: ShipId | null,
): StepFn[] {
  return payments.filter((p) => p.amount > 0).map((p) => (current: MatchState) => changeCash(current, p.playerId, p.amount, reason, shipId));
}
