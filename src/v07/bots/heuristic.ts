import {
  GOODS,
  buildingCost,
  createRng,
  roleFee,
  shipCostFor,
  traitOf,
  type Action,
  type PlayerView,
} from '../game';
import { choose } from './choose';
import {
  SMUGGLER_GUARDED_CHANCE,
  ARMS_SEIZURE_RISK,
  arriveChance,
  averagePrice,
  buildingWorth,
  carriesWanted,
  currentPrice,
  expectedPrice,
  expectedSeizure,
  insuredValue,
  me,
  othersExpectedArrivals,
  ownArmsValue,
  perUnitCost,
  seizureRisk,
  shiftValue,
  stakeOn,
} from './estimates';
import { islandWorth } from './islands';
import { PERSONALITIES, type Personality, type PersonalityName } from './personality';
import type { Bot } from './types';

type Invest = Extract<Action, { type: 'invest' }>;
type Deploy = Extract<Action, { type: 'deploy-role' }>;
type Reroll = Extract<Action, { type: 'intel-reroll' }>;

function scoreInvest(view: PlayerView, action: Invest, persona: Personality): number {
  const { rules } = view;
  const player = me(view);
  const trait = traitOf(rules, player.island);
  const p = arriveChance(rules, trait.ownShipModifier);
  const insured = player.buildings.includes('insurance') || action.build === 'insurance';
  const cost = action.build === null ? null : buildingCost(rules, action.build);
  const lastRound = view.round >= rules.rounds;
  const shippedUnits = GOODS.reduce((sum, g) => sum + action.load[g], 0);
  let score = shippedUnits > 0 ? -shipCostFor(rules, player.island) : 0;
  let cargoValue = 0;
  for (const g of GOODS) {
    const shipped = action.load[g];
    const price = expectedPrice(view, g, shipped);
    const atRisk = shipped * price * (1 - p);
    score += shipped * price * p * (1 - seizureRisk(g)) - atRisk * persona.risk * (insured ? 0.5 : 1);
    cargoValue += shipped * price;
    // §6.3: spice spoils at round end (Spice Isles excepted); leftovers are worthless after round 6.
    const spoils = lastRound || (g === 'spice' && trait.keepsSpice !== 1);
    const keepEach = spoils ? 0 : Math.max(0, currentPrice(view, g) * p - perUnitCost(rules)) * persona.patience;
    score += (view.myStock[g] - (cost?.[g] ?? 0) - shipped) * keepEach;
  }
  if (insured && shippedUnits > 0) {
    score += (1 - p) * insuredValue(rules, shippedUnits, cargoValue / shippedUnits);
  }
  if (action.build !== null) {
    score += persona.builder * buildingWorth(view, action.build) - rules.buildings.costs[action.build].cash;
  }
  return score;
}

/**
 * Broker bet: the payout times a rough chance the price moves the bet's way (arrivals guessed
 * against the shifted demand), plus the shift's effect on my landed units and on rivals.
 */
function scoreBet(view: PlayerView, action: Deploy): number {
  const { rules } = view;
  const bet = action.bet;
  if (bet === null) {
    return 0;
  }
  const p = arriveChance(rules, 0);
  const mine = view.ships.reduce((sum, s) => sum + (s.owner === view.playerId ? (s.cargo?.[bet.good] ?? 0) : 0), 0);
  const shift = bet.direction * rules.roles.broker.shift;
  const gap = view.demand[bet.good] + shift - (othersExpectedArrivals(view, bet.good) + mine * p);
  const step = view.prices[bet.good];
  const room = bet.direction > 0 ? step < rules.price.steps - 1 : step > 0;
  const chance = room ? Math.min(0.95, Math.max(0.05, 0.45 + 0.25 * gap * bet.direction)) : 0;
  return rules.roles.broker.payout * chance + shiftValue(view, bet.good, shift, mine) - roleFee(rules, me(view).island, 'broker');
}

function scoreDeploy(view: PlayerView, action: Deploy, persona: Personality): number {
  if (action.role === 'broker') {
    return scoreBet(view, action);
  }
  const ship = view.ships.find((s) => s.id === action.targetShipId);
  if (action.role === null || ship === undefined) {
    return 0;
  }
  const { rules } = view;
  const player = me(view);
  const trait = traitOf(rules, player.island);
  const stake = stakeOn(view, ship);
  const base = arriveChance(rules, 0);
  const fee = roleFee(rules, player.island, action.role);
  switch (action.role) {
    case 'guard': {
      const boost =
        rules.roles.guard.modifier + trait.guardModifier + (player.buildings.includes('insurance') ? rules.buildings.insurance.guardBonus : 0);
      const guarded = arriveChance(rules, boost);
      const seizure = expectedSeizure(view, ship);
      // §9.4: confiscating arms forfeits the escort fee, which is only paid for others' ships.
      const forfeit = seizure === 0 ? 0 : Math.min(1, seizure / currentPrice(view, 'arms'));
      const escort = ship.owner !== view.playerId ? rules.roles.guard.escortFee * guarded * (1 - forfeit) : 0;
      return (guarded - base) * stake + escort + seizure * guarded - fee;
    }
    case 'pirate': {
      const attacked = arriveChance(rules, rules.roles.pirate.modifier + trait.pirateModifier);
      const loot = (rules.roles.pirate.loot + (carriesWanted(view, ship) ? rules.wanted.lootBonus : 0)) * (1 - attacked);
      const salvage = player.buildings.includes('salvage') && stake === 0 ? (base - attacked) * averagePrice(view) * base : 0;
      return loot * persona.aggression + salvage - (base - attacked) * stake - fee;
    }
    case 'smuggler': {
      if (ship.owner === view.playerId) {
        // Covering my own arms (§9.5): worth it only if another guard would board; Smuggler Port cannot be covered.
        return trait.armsUncoverable === 1 ? -fee : ownArmsValue(view, ship) * ARMS_SEIZURE_RISK * base - fee;
      }
      const { goodsValue, fine } = rules.roles.smuggler;
      return base * ((1 - SMUGGLER_GUARDED_CHANCE) * goodsValue - SMUGGLER_GUARDED_CHANCE * fine) - fee;
    }
    case 'intel': {
      const peek = view.ships.find((s) => s.id === action.peekShipId);
      return (stake + (peek === undefined ? 0 : stakeOn(view, peek))) * (1 - base) * base * 0.5 - fee;
    }
  }
}

/** Reroll the first looked-at ship carrying my cargo whose roll would sink it, else none (§9.4). */
function wantedReroll(view: PlayerView): string | null {
  const want = view.intel.find(({ shipId, rawRoll, rerolledRoll }) => {
    const ship = view.ships.find((s) => s.id === shipId);
    return ship !== undefined && stakeOn(view, ship) > 0 && (rerolledRoll ?? rawRoll) < view.rules.sailing.successMin;
  });
  return want?.shipId ?? null;
}

function scoreReroll(view: PlayerView, action: Reroll): number {
  return action.rerollShipId === wantedReroll(view) ? 1 : 0;
}

export function scoreAction(view: PlayerView, action: Action, persona: Personality): number {
  switch (action.type) {
    case 'choose-island':
      return islandWorth(view, action.island, persona);
    case 'invest':
      return scoreInvest(view, action, persona);
    case 'deploy-role':
      return scoreDeploy(view, action, persona);
    case 'intel-reroll':
      return scoreReroll(view, action);
  }
}

/** Expected-value bot; scores every legal action and samples by softmax. */
export function createHeuristicBot(personality: PersonalityName | Personality, seed: number): Bot {
  const persona: Personality = typeof personality === 'string' ? PERSONALITIES[personality] : personality;
  const rng = createRng(seed);
  return {
    decide({ view, legalActions }) {
      if (legalActions.length === 0) {
        throw new Error(`${view.playerId} has no legal action in ${view.phase}`);
      }
      const scores = legalActions.map((a) => scoreAction(view, a, persona));
      // The reroll is a plain rule of thumb, not an estimate in G: always follow it.
      const temperature = view.phase === 'intel-reroll' ? 0 : persona.temperature;
      return choose(legalActions, scores, temperature, rng);
    },
  };
}
