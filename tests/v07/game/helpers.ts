import {
  applyAction,
  createMatch,
  RULES_BUILDINGS,
  RULES_V08_PROTO,
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

/**
 * V0.8 prototype: RULES_V08_PROTO before the 2026-11-15 simplification (island variants, late cards, all six cards flip
 * in phase II, modifier-only storm and pirate tides, the armory caps only sinking loot). The tests written against those
 * settings are pinned to it.
 */
/**
 * RULES_V08_PROTO before the 2026-11-15 tide shields (each building ignores its matching tide) and the bots' crate-table
 * pirate valuation: the settings the simplification tests (v08-simplify.test.ts) were written for.
 */
/**
 * The prototype before the 2026-11-22 changes: the armory halves every pirate take and pays back the half it kept on a
 * sunk ship (no armed merchant), the tradehouse keeps a named good's price (no buyout), and the pirate tide takes 30 %
 * of an arrival (not a crate). The older fixtures below build on it.
 */
export const RULES_V08_PRE_ARMED: Rules = {
  ...RULES_V08_PROTO,
  v08: {
    ...RULES_V08_PROTO.v08,
    armory: { ...RULES_V08_PROTO.v08.armory, halveAllLoot: 1, refundSunkLoot: 1, armedBonus: 0, armedMaxFinal: 0, counter: 0 },
    tradehouse: { ...RULES_V08_PROTO.v08.tradehouse, named: 1, buyoutFloor: 0, buyoutFixed: 0 },
    events: { ...RULES_V08_PROTO.v08.events, tidePirateArrivalCrates: 0 },
  },
};

/** The prototype before the 2026-11-16 equal building costs and armory toll. */
export const RULES_V08_PRE_EQUAL_COSTS: Rules = {
  ...RULES_V08_PRE_ARMED,
  v08: {
    ...RULES_V08_PRE_ARMED.v08,
    costs: {
      ...RULES_V08_PRE_ARMED.v08.costs,
      build: {
        repairyard: G(2, 1),
        armory: G(0, 0, 0, 2),
        tradehouse: G(0, 0, 2),
      },
    },
    armory: { ...RULES_V08_PRE_ARMED.v08.armory, pirateToll: 0 },
  },
};

export const RULES_V08_PRE_SHIELDS: Rules = {
  ...RULES_V08_PRE_EQUAL_COSTS,
  v08: {
    ...RULES_V08_PRE_EQUAL_COSTS.v08,
    repairyard: { ...RULES_V08_PRE_EQUAL_COSTS.v08.repairyard, immuneStormTide: 0 },
    armory: { ...RULES_V08_PRE_EQUAL_COSTS.v08.armory, immunePirateTide: 0 },
    tradehouse: { ...RULES_V08_PRE_EQUAL_COSTS.v08.tradehouse, immuneCrashTide: 0 },
    botPirateCrates: 0,
  },
};

export const RULES_V08_PRE_SIMPLIFY: Rules = {
  ...RULES_V08_PRE_SHIELDS,
  v08: {
    ...RULES_V08_PRE_SHIELDS.v08,
    islandVariants: 1,
    armory: { ...RULES_V08_PRE_SHIELDS.v08.armory, halveAllLoot: 0 },
    events: {
      ...RULES_V08_PRE_SHIELDS.v08.events,
      lateCards: 1,
      flipOnlyTideCard: 0,
      tideStorm: -1,
      tideStormExtraLoss: 0,
      tidePirate: -1,
      tidePirateArrivalLoot: 0,
    },
  },
};

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
export function draft(players = 4, rules?: Rules, seed = 7): Played {
  // The mechanics tests pin the numbers of the rules with buildings (game-design.md before 2026-11-05); the ship bays (the default) have their own tests.
  const created = createMatch({ seed, players: IDS.slice(0, players).map((id) => ({ id, name: id })), rules: rules ?? RULES_BUILDINGS });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  return { state: created.value.state, events: [...created.value.events], privateEvents: [...created.value.privateEvents] };
}

/**
 * Round 1, investment phase. Everyone keeps their first offered island; `islands` then overrides
 * islands for scenario tests (round-1 production already used the drafted island).
 */
export function start(players = 4, rules?: Rules, islands: Readonly<Partial<Record<string, IslandId>>> = {}): MatchState {
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
export function plain(players = 4, rules?: Rules): MatchState {
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
  /** V0.8 prototype: extra invest fields by player (material action, raise, private crates, protected good). */
  readonly invest?: Readonly<Record<string, Pick<Extract<Action, { type: 'invest' }>, 'material' | 'raise' | 'privateLoad' | 'protect'>>>;
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
    step({ type: 'invest', playerId: p.id, build: plan.builds?.[p.id] ?? null, load, ...(sails && shipType !== undefined ? { shipType } : {}), ...plan.invest?.[p.id] });
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
