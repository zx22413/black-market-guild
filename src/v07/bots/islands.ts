import { GOODS, ROLE_IDS, capacityFor, cooldownFor, producedFor, roleFee, traitOf, type GoodId, type IslandId, type PlayerView, type RoleId, type Rules } from '../game';
import { ARMS_SEIZURE_RISK, arriveChance, averagePrice, perUnitCost, seizureRisk } from './estimates';
import type { Personality } from './personality';

// Island draft (§11.1): estimate what each island's trait (§11.2) is worth over the whole match,
// in G relative to an island without traits, from public rule numbers only.

/** Share of rounds a bot is assumed to sail. */
const SAIL_RATE = 0.8;
/** Share of a role's available rounds a bot is assumed to deploy it. */
const ROLE_USE_SHARE = 0.5;
/** Chance a good's price rises in a given round. */
const RISE_CHANCE = 0.4;
/** Share of spice that would have spoiled but can be shipped later instead. */
const KEPT_SPICE_SHARE = 0.3;
/** Share of produced arms a bot would have covered with its own smuggler. */
const COVER_SHARE = 0.1;

/** Expected net value of one more unit of a good: its sale minus its share of the ship cost. */
function unitValue(rules: Rules, price: number, good: GoodId, persona: Personality): number {
  const net = Math.max(0, price * arriveChance(rules, 0) - perUnitCost(rules)) * (1 - seizureRisk(good));
  return good === 'wood' || good === 'iron' ? net * persona.patience * persona.builder : net;
}

function productionWorth(rules: Rules, island: IslandId, price: number, persona: Personality): number {
  let worth = 0;
  for (let round = 1; round <= rules.rounds; round += 1) {
    const mine = producedFor(rules, island, round);
    const plain = producedFor(rules, null, round);
    worth += GOODS.reduce((sum, g) => sum + (mine[g] - plain[g]) * unitValue(rules, price, g, persona), 0);
  }
  return worth;
}

/** Units of a good this island produces per round on average. */
function perRound(rules: Rules, island: IslandId, good: GoodId): number {
  let total = 0;
  for (let round = 1; round <= rules.rounds; round += 1) {
    total += producedFor(rules, island, round)[good];
  }
  return total / rules.rounds;
}

/** Spice Isles: only half a price rise (rounded down) counts on own sales, so the rest is lost. */
function halfRiseCost(rules: Rules, island: IslandId): number {
  const t = traitOf(rules, island);
  return GOODS.reduce((sum, g) => {
    if (t.halfRise[g] !== 1) {
      return sum;
    }
    const rise = rules.price.volatility[g];
    const lost = (rise - Math.floor(rise / 2)) * rules.price.step;
    return sum + rules.rounds * perRound(rules, island, g) * lost * RISE_CHANCE;
  }, 0);
}

/**
 * Value of one deployment of a role with an island's modifiers and fees. Not clamped at zero:
 * softmax bots still deploy roles that score slightly negative.
 */
function roleUseValue(view: PlayerView, island: IslandId | null, role: RoleId, cargo: number, persona: Personality): number {
  const { rules } = view;
  const t = traitOf(rules, island);
  const p = arriveChance(rules, 0);
  const fee = roleFee(rules, island, role);
  switch (role) {
    case 'guard':
      return (arriveChance(rules, rules.roles.guard.modifier + t.guardModifier) - p) * cargo * (1 + persona.risk) - fee;
    case 'pirate': {
      // §9.6: assume the target carries a wanted player's goods 1 time in N players.
      const loot = rules.roles.pirate.loot + rules.wanted.lootBonus / view.players.length;
      return (p - arriveChance(rules, rules.roles.pirate.modifier + t.pirateModifier)) * loot * persona.aggression - fee;
    }
    case 'intel':
      return (1 + t.intelPeeks) * cargo * (1 - p) * p * 0.5 - fee;
    case 'smuggler':
    case 'broker':
      return -fee;
  }
}

function roleUses(rules: Rules, island: IslandId | null, role: RoleId): number {
  return (rules.rounds / (cooldownFor(rules, island, role) + 1)) * ROLE_USE_SHARE;
}

/** Estimated worth in G of drafting `island`, from the view's rules, prices and player count. */
export function islandWorth(view: PlayerView, island: IslandId, persona: Personality): number {
  const { rules } = view;
  const t = traitOf(rules, island);
  const price = averagePrice(view);
  const p = arriveChance(rules, 0);
  const sails = rules.rounds * SAIL_RATE;
  const capacity = capacityFor(rules, [], island);
  const cargo = capacity * price;

  const sailing =
    (arriveChance(rules, t.ownShipModifier) - p) * cargo * sails * (1 + persona.risk) -
    t.shipCostDelta * sails +
    t.capacityDelta * sails * price * p * 0.6;
  const roles = ROLE_IDS.reduce(
    (sum, role) =>
      sum + roleUses(rules, island, role) * roleUseValue(view, island, role, cargo, persona) - roleUses(rules, null, role) * roleUseValue(view, null, role, cargo, persona),
    0,
  );
  const spice = t.keepsSpice === 1 ? rules.rounds * perRound(rules, island, 'spice') * Math.max(0, price * p - perUnitCost(rules)) * KEPT_SPICE_SHARE : 0;
  const cover = t.armsUncoverable === 1 ? rules.rounds * perRound(rules, island, 'arms') * price * ARMS_SEIZURE_RISK * COVER_SHARE : 0;

  return productionWorth(rules, island, price, persona) + sailing + roles + spice - halfRiseCost(rules, island) - cover;
}
