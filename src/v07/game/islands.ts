import { shuffle, type RngState } from './rng';
import { NEUTRAL_TRAIT, shipFinalCap, type IslandTrait, type Rules } from './rules';
import { ISLAND_IDS, type BuildingId, type GoodId, type Goods, type IslandId, type PlayerId, type RoleId, type ShipTypeId } from './types';

// Island traits (§11).

export function traitOf(rules: Rules, island: IslandId | null): IslandTrait {
  return island === null ? NEUTRAL_TRAIT : rules.islands.traits[island];
}

/** §6.2 with the island's production overrides, cut-off round and bonus units. */
export function producedFor(rules: Rules, island: IslandId | null, round: number): Goods {
  const t = traitOf(rules, island);
  const produced = (good: GoodId) => {
    const every = t.productionEvery[good] > 0 ? t.productionEvery[good] : rules.productionEvery[good];
    const until = t.productionUntil[good];
    const due = (round - 1) % every === 0 && (until === 0 || round <= until);
    return (due ? rules.production[good] : 0) + t.bonusProduction[good];
  };
  return { wood: produced('wood'), iron: produced('iron'), spice: produced('spice'), arms: produced('arms') };
}

export function roleFee(rules: Rules, island: IslandId | null, role: RoleId): number {
  return rules.roles.fees[role] + traitOf(rules, island).feeDelta[role];
}

export function shipCostFor(rules: Rules, island: IslandId | null, type: ShipTypeId = 'standard'): number {
  const t = traitOf(rules, island);
  const base = rules.ships.enabled === 1 ? (t.freeShips.includes(type) ? 0 : rules.ships.types[type].fee) : rules.shipCost;
  return Math.max(0, base + t.shipCostDelta);
}

/** §8: base capacity, shipyard bonus (a shipyard built this round counts), island change. */
export function capacityFor(rules: Rules, buildings: readonly BuildingId[], island: IslandId | null): number {
  return rules.capacity.base + (buildings.includes('shipyard') ? rules.capacity.shipyardBonus : 0) + traitOf(rules, island).capacityDelta;
}

/** §9.1 step 6: the highest final value a ship of `type` owned by a player on `island` can reach (the island's limit and the type's own, whichever is lower). */
export function shipFinalCapFor(rules: Rules, island: IslandId | null, type: ShipTypeId): number {
  const limit = traitOf(rules, island).ownShipFinalCap;
  const cap = shipFinalCap(rules, type);
  return limit > 0 ? Math.min(cap, limit) : cap;
}

export function cooldownFor(rules: Rules, island: IslandId | null, role: RoleId): number {
  return rules.roles.cooldown + traitOf(rules, island).cooldownDelta[role];
}

/**
 * §11.1: shuffle the islands and deal `offered` distinct islands to each player in seat order,
 * refilling with a fresh shuffle if the deck runs out.
 */
export function dealIslandOffers(
  playerIds: readonly PlayerId[],
  offered: number,
  rng: RngState,
): { offers: Record<PlayerId, IslandId[]>; state: RngState } {
  let deck: IslandId[] = [];
  let state = rng;
  const offers: Record<PlayerId, IslandId[]> = {};
  for (const id of playerIds) {
    const hand: IslandId[] = [];
    while (hand.length < Math.min(offered, ISLAND_IDS.length)) {
      if (deck.length === 0) {
        const shuffled = shuffle([...ISLAND_IDS], state);
        deck = shuffled.items;
        state = shuffled.state;
      }
      const [next, ...rest] = deck;
      deck = rest;
      if (next !== undefined && !hand.includes(next)) {
        hand.push(next);
      }
    }
    offers[id] = hand;
  }
  return { offers, state };
}

