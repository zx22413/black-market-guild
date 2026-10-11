import type { BuildingId, CashReason, EconPlayer, EconomyState, EconomyStep, Goods, PlayerId, ShipId } from './types';

export function playerOf(state: EconomyState, playerId: PlayerId): EconPlayer {
  const player = state.players.find((p) => p.id === playerId);
  if (player === undefined) {
    throw new Error(`unknown player: ${playerId}`);
  }
  return player;
}

export function holds(state: EconomyState, playerId: PlayerId, building: BuildingId): boolean {
  return playerOf(state, playerId).buildings.includes(building);
}

export function updatePlayer(
  state: EconomyState,
  playerId: PlayerId,
  update: (player: EconPlayer) => EconPlayer,
): EconomyState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? update(p) : p)) };
}

export function setStock(state: EconomyState, playerId: PlayerId, stock: Goods): EconomyState {
  return updatePlayer(state, playerId, (p) => ({ ...p, stock }));
}

/** Adds `amount` (negative to charge); legal actions must keep cash non-negative. */
export function changeCash(
  state: EconomyState,
  playerId: PlayerId,
  amount: number,
  reason: CashReason,
  shipId: ShipId | null,
): EconomyStep {
  const player = playerOf(state, playerId);
  if (player.cash + amount < 0) {
    throw new Error(`${playerId} cannot afford ${-amount} G for ${reason}`);
  }
  return {
    state: updatePlayer(state, playerId, (p) => ({ ...p, cash: p.cash + amount })),
    events: [{ type: 'cash-changed', round: state.round, playerId, amount, reason, shipId }],
  };
}

export type StepFn = (state: EconomyState) => EconomyStep;

/** Applies steps in order, collecting their events. */
export function chain(state: EconomyState, steps: readonly StepFn[]): EconomyStep {
  return steps.reduce<EconomyStep>(
    (acc, step) => {
      const next = step(acc.state);
      return { state: next.state, events: [...acc.events, ...next.events] };
    },
    { state, events: [] },
  );
}

/** Pays positive amounts only. */
export function payAll(
  payments: readonly { readonly playerId: PlayerId; readonly amount: number }[],
  reason: CashReason,
  shipId: ShipId,
): StepFn[] {
  return payments
    .filter((p) => p.amount > 0)
    .map((p) => (current: EconomyState) => changeCash(current, p.playerId, p.amount, reason, shipId));
}
