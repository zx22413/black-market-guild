import {
  applyAction,
  createMatch,
  type Action,
  type BuildingId,
  type GoodId,
  type Goods,
  type IslandId,
  type MatchEvent,
  type MatchState,
  type PrivateEvent,
  type RoleId,
  type Rules,
  type ShipTypeId,
  type VoyageEventId,
} from '../../../src/v07/game';

export const IDS = ['p1', 'p2', 'p3', 'p4'] as const;

export function G(wood: number, iron = 0, spice = 0, arms = 0): Goods {
  return { wood, iron, spice, arms };
}

export interface Played {
  readonly state: MatchState;
  readonly events: MatchEvent[];
  readonly privateEvents: PrivateEvent[];
}

export function apply(state: MatchState, action: Action): Played {
  const result = applyAction(state, action);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return { state: result.value.state, events: [...result.value.events], privateEvents: [...result.value.privateEvents] };
}

/** A new match still in the island draft. */
export function draft(players = 3, rules?: Rules, seed = 7): Played {
  const created = createMatch({ seed, players: IDS.slice(0, players).map((id) => ({ id, name: id })), ...(rules ? { rules } : {}) });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  return { state: created.value.state, events: [...created.value.events], privateEvents: [...created.value.privateEvents] };
}

/**
 * Round 1, investment phase. Everyone keeps their first offered island; `islands` then overrides
 * islands for scenario tests (round-1 production already used the drafted island).
 */
export function start(players = 3, rules?: Rules, islands: Readonly<Partial<Record<string, IslandId>>> = {}): MatchState {
  let state = draft(players, rules).state;
  for (const p of state.players) {
    state = apply(state, { type: 'choose-island', playerId: p.id, island: state.islandOffers[p.id]![0]! }).state;
  }
  return { ...state, players: state.players.map((p) => ({ ...p, island: islands[p.id] ?? p.island })) };
}

/** Rewrites a player for a scenario; a new stock also becomes the round's public opening stock. */
export function edit(state: MatchState, playerId: string, patch: Partial<MatchState['players'][number]>): MatchState {
  const stockAtStart = patch.stock === undefined ? state.roundState.stockAtStart : { ...state.roundState.stockAtStart, [playerId]: patch.stock };
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
    roundState: { ...state.roundState, stockAtStart },
  };
}

export function withDemand(state: MatchState, demand: Goods): MatchState {
  return { ...state, roundState: { ...state.roundState, demand } };
}

export function withPrices(state: MatchState, prices: Goods): MatchState {
  return { ...state, prices };
}

export function withWanted(state: MatchState, wanted: readonly string[]): MatchState {
  return { ...state, roundState: { ...state.roundState, wanted } };
}

/** Neutral islands are not dealt in play; this strips traits for scenario tests that need plain rules. */
export function plain(players = 3, rules?: Rules): MatchState {
  const state = start(players, rules);
  return { ...state, players: state.players.map((p) => ({ ...p, island: null })) };
}

export interface RoundPlan {
  readonly loads?: Readonly<Record<string, Goods>>;
  readonly builds?: Readonly<Record<string, BuildingId>>;
  /** Raw roll per owner; unlisted ships roll 6. */
  readonly rolls?: Readonly<Record<string, number>>;
  /** Roles by player: [role, owner of the target ship]. */
  readonly roles?: Readonly<Record<string, readonly [RoleId, string]>>;
  /** A diplomat on its own ship, by player: the role it guesses. */
  readonly diplomats?: Readonly<Record<string, RoleId>>;
  /** Experiment (rules.ships): the ship type a sailing player picks (standard when unlisted). */
  readonly shipTypes?: Readonly<Record<string, ShipTypeId>>;
  /** The good a customs officer names, by player. */
  readonly named?: Readonly<Record<string, GoodId>>;
  readonly voyageEvent?: VoyageEventId;
}

const shipOf = (state: MatchState, owner: string) => `r${state.round}-${owner}`;

/** Plays one full round with fixed choices, rolls and voyage event. */
export function playRound(state: MatchState, plan: RoundPlan = {}): Played {
  let current = state;
  const events: MatchEvent[] = [];
  const privateEvents: PrivateEvent[] = [];
  const step = (action: Action) => {
    const r = apply(current, action);
    current = r.state;
    events.push(...r.events);
    privateEvents.push(...r.privateEvents);
  };
  for (const p of current.players) {
    const load = plan.loads?.[p.id] ?? G(0);
    const sails = load.wood + load.iron + load.spice + load.arms > 0;
    const shipType = plan.shipTypes?.[p.id] ?? (sails && current.rules.ships.enabled === 1 ? 'standard' : undefined);
    step({ type: 'invest', playerId: p.id, build: plan.builds?.[p.id] ?? null, load, ...(sails && shipType !== undefined ? { shipType } : {}) });
  }
  const owner = (shipId: string) => shipId.split('-')[1]!;
  current = {
    ...current,
    roundState: { ...current.roundState, voyageEvent: plan.voyageEvent ?? 'calm-seas', ships: current.roundState.ships.map((s) => ({ ...s, rawRoll: plan.rolls?.[owner(s.id)] ?? 6 })) },
  };
  if (current.phase === 'role-deployment') {
    for (const p of current.players) {
      const role = plan.roles?.[p.id];
      const guess = plan.diplomats?.[p.id];
      step(
        guess !== undefined
          ? { type: 'deploy-role', playerId: p.id, role: 'diplomat', targetShipId: shipOf(current, p.id), namedGood: null, guessRole: guess }
          : {
              type: 'deploy-role',
              playerId: p.id,
              role: role?.[0] ?? null,
              targetShipId: role === undefined ? null : shipOf(current, role[1]),
              namedGood: plan.named?.[p.id] ?? null,
            },
      );
    }
  }
  return { state: current, events, privateEvents };
}

export function cash(events: readonly MatchEvent[], reason: string, playerId?: string): number {
  return events
    .filter((e) => e.type === 'cash-changed' && e.reason === reason && (playerId === undefined || e.playerId === playerId))
    .reduce((sum, e) => sum + (e.type === 'cash-changed' ? e.amount : 0), 0);
}

export function find<T extends MatchEvent['type']>(events: readonly MatchEvent[], type: T): Extract<MatchEvent, { type: T }>[] {
  return events.filter((e): e is Extract<MatchEvent, { type: T }> => e.type === type);
}

export function stockOf(state: MatchState, playerId: string): Goods {
  return state.players.find((p) => p.id === playerId)!.stock;
}

export function cashOf(state: MatchState, playerId: string): number {
  return state.players.find((p) => p.id === playerId)!.cash;
}
