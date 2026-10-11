import type { EconomyRules } from './rules';
import { MATERIALS, type BuildingId, type EconRoleId, type Goods, type IslandId, type Material } from './types';

// Island traits (proposal §27): each player's island has an advantage and a drawback.

/** Every field is numeric so simulations can override it with --set. */
export interface IslandTrait {
  /** Per material: produce every N rounds instead of the rule set's value; 0 keeps the default. */
  readonly productionEvery: Goods;
  /** 1 = perishable goods do not spoil in this warehouse. */
  readonly keepsPerishable: number;
  /** Added to this player's own ship's roll. */
  readonly ownShipModifier: number;
  /** Added per pirate this player deploys (on top of the pirate modifier). */
  readonly pirateModifier: number;
  /** Added per guard this player deploys. */
  readonly guardModifier: number;
  /** Added to this player's deployment fee per role. */
  readonly feeDelta: Readonly<Record<EconRoleId, number>>;
  /** Added to this player's ship cost. */
  readonly shipCostDelta: number;
  /** Added to this player's capacity. */
  readonly capacityDelta: number;
  /** 1 = smugglers cannot cover this player's contraband. */
  readonly uncoverable: number;
}

const NO_FEES: Readonly<Record<EconRoleId, number>> = { intel: 0, guard: 0, pirate: 0, smuggler: 0, broker: 0 };

export const NEUTRAL_TRAIT: IslandTrait = {
  productionEvery: { wood: 0, iron: 0, spice: 0, contraband: 0 },
  keepsPerishable: 0,
  ownShipModifier: 0,
  pirateModifier: 0,
  guardModifier: 0,
  feeDelta: NO_FEES,
  shipCostDelta: 0,
  capacityDelta: 0,
  uncoverable: 0,
};

function trait(patch: Partial<IslandTrait>): IslandTrait {
  return { ...NEUTRAL_TRAIT, ...patch };
}

const every = (patch: Partial<Goods>): Goods => ({ ...NEUTRAL_TRAIT.productionEvery, ...patch });

/** Placeholder traits from proposal §25.3; numbers are for simulation only. */
export const DEFAULT_ISLAND_TRAITS: Readonly<Record<IslandId, IslandTrait>> = {
  'spice-isles': trait({ keepsPerishable: 1, productionEvery: every({ wood: 6 }) }),
  'pirate-cove': trait({ pirateModifier: -1, ownShipModifier: -1 }),
  lumber: trait({ productionEvery: every({ wood: 1, iron: 6 }) }),
  mine: trait({ productionEvery: every({ iron: 1, wood: 6 }) }),
  'smuggler-port': trait({ productionEvery: every({ contraband: 1 }), uncoverable: 1 }),
  'free-port': trait({ shipCostDelta: -50, capacityDelta: -1 }),
  fortress: trait({ guardModifier: 1, feeDelta: { ...NO_FEES, pirate: 50 } }),
};

export function traitOf(rules: EconomyRules, island: IslandId | null): IslandTrait {
  return island === null || rules.islands.enabled !== 1 ? NEUTRAL_TRAIT : rules.islands.traits[island];
}

export function productionEveryFor(rules: EconomyRules, island: IslandId | null, material: Material): number {
  const override = traitOf(rules, island).productionEvery[material];
  return override > 0 ? override : rules.productionEvery[material];
}

export function producedFor(rules: EconomyRules, island: IslandId | null, round: number): Goods {
  return Object.fromEntries(
    MATERIALS.map((m) => [m, (round - 1) % productionEveryFor(rules, island, m) === 0 ? rules.production[m] : 0]),
  ) as Record<Material, number>;
}

export function roleFee(rules: EconomyRules, island: IslandId | null, role: EconRoleId): number {
  return rules.roles[role].fee + traitOf(rules, island).feeDelta[role];
}

/** Units a player may ship this round; a shipyard built this round already counts. */
export function capacityFor(rules: EconomyRules, buildings: readonly BuildingId[], island: IslandId | null): number {
  return rules.capacity.base + (buildings.includes('shipyard') ? rules.capacity.shipyardBonus : 0) + traitOf(rules, island).capacityDelta;
}
