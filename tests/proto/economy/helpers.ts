import {
  applyEconomyAction,
  createEconomyMatch,
  economyRules,
  type BuildingId,
  type EconomyEvent,
  type EconomyMode,
  type EconomyRules,
  type EconomyState,
  type EconRoleId,
  type Goods,
  type Manipulation,
  type ProtoVoyageEventId,
} from '../../../src/proto/economy';

export const IDS = ['p1', 'p2', 'p3', 'p4'] as const;

/** Goods with all four materials; unspecified ones are 0. */
export function G(wood: number, iron = 0, spice = 0, contraband = 0): Goods {
  return { wood, iron, spice, contraband };
}

export function start(mode: EconomyMode, players = 3, rules?: EconomyRules): EconomyState {
  const created = createEconomyMatch({
    seed: 7,
    players: IDS.slice(0, players).map((id) => ({ id, name: id })),
    rules: rules ?? economyRules(mode),
  });
  if (!created.ok) {
    throw new Error(created.error);
  }
  return created.value.state;
}

export function withStock(state: EconomyState, playerId: string, stock: Goods, cash?: number): EconomyState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, stock, ...(cash === undefined ? {} : { cash }) } : p)),
  };
}

export function withBuildings(state: EconomyState, playerId: string, buildings: readonly BuildingId[]): EconomyState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, buildings } : p)) };
}

export function withDemand(state: EconomyState, demand: Goods): EconomyState {
  return { ...state, roundState: { ...state.roundState, demand } };
}

export function withWanted(state: EconomyState, wanted: readonly string[]): EconomyState {
  return { ...state, roundState: { ...state.roundState, wanted } };
}

export function apply(state: EconomyState, action: Parameters<typeof applyEconomyAction>[1]): { state: EconomyState; events: EconomyEvent[] } {
  const result = applyEconomyAction(state, action);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return { state: result.value.state, events: [...result.value.events] };
}

export interface RoundPlan {
  readonly loads: Readonly<Record<string, Goods>>;
  readonly builds?: Readonly<Record<string, BuildingId>>;
  readonly direct?: Readonly<Record<string, Goods>>;
  readonly manipulate?: Readonly<Record<string, Manipulation>>;
  /** Raw roll per ship id; ships not listed roll 6. */
  readonly rolls?: Readonly<Record<string, number>>;
  readonly roles?: Readonly<Record<string, readonly [Exclude<EconRoleId, 'broker'>, string]>>;
  /** Broker bets, instead of a ship role. */
  readonly bets?: Readonly<Record<string, Manipulation>>;
  readonly voyageEvent?: ProtoVoyageEventId;
}

/** Plays one full round with fixed loads, rolls, roles and voyage event; returns the next state. */
export function playRound(state: EconomyState, plan: RoundPlan): { state: EconomyState; events: EconomyEvent[] } {
  let current = state;
  const events: EconomyEvent[] = [];
  for (const p of current.players) {
    const step = apply(current, {
      type: 'invest',
      playerId: p.id,
      build: plan.builds?.[p.id] ?? null,
      load: plan.loads[p.id] ?? G(0),
      direct: plan.direct?.[p.id] ?? G(0),
      manipulate: plan.manipulate?.[p.id] ?? null,
    });
    current = step.state;
    events.push(...step.events);
  }
  current = {
    ...current,
    voyageDeck: [plan.voyageEvent ?? 'calm-seas', ...current.voyageDeck],
    roundState: {
      ...current.roundState,
      ships: current.roundState.ships.map((s) => ({ ...s, rawRoll: plan.rolls?.[s.id] ?? 6 })),
    },
  };
  if (current.phase === 'role-deployment') {
    for (const p of current.players) {
      const role = plan.roles?.[p.id];
      const bet = plan.bets?.[p.id];
      const step = apply(
        current,
        bet !== undefined
          ? { type: 'deploy-role', playerId: p.id, role: 'broker', targetShipId: null, bet }
          : { type: 'deploy-role', playerId: p.id, role: role?.[0] ?? null, targetShipId: role?.[1] ?? null, bet: null },
      );
      current = step.state;
      events.push(...step.events);
    }
  }
  while (current.phase === 'intel-reroll') {
    const pending = current.roundState.deployments.filter((d) => d.role === 'intel' && current.roundState.submissions[d.playerId] === undefined);
    const next = pending[0];
    if (next === undefined) {
      break;
    }
    const step = apply(current, { type: 'intel-reroll', playerId: next.playerId, reroll: false });
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
}

export function cashOf(state: EconomyState, playerId: string): number {
  return state.players.find((p) => p.id === playerId)!.cash;
}

export function stockOf(state: EconomyState, playerId: string): Goods {
  return state.players.find((p) => p.id === playerId)!.stock;
}

export function cashEvents(events: readonly EconomyEvent[], reason: string, playerId?: string): number {
  return events
    .filter((e) => e.type === 'cash-changed' && e.reason === reason && (playerId === undefined || e.playerId === playerId))
    .reduce((sum, e) => sum + (e.type === 'cash-changed' ? e.amount : 0), 0);
}
