import { createRng, type Rng } from '../../../game';
import { shippingCost } from '../decisions';
import { subtractGoods } from '../goods';
import { buildingCostGoods } from '../rules';
import type { EconomyDecider } from '../runner';
import { MATERIALS, type EconomyAction, type Material } from '../types';
import type { EconomyView } from '../view';
import {
  arriveChance,
  averagePrice,
  buildingWorth,
  carriesWanted,
  currentPrice,
  directSalePrice,
  expectedPrice,
  expectedSeizure,
  seizureRisk,
  shiftValue,
  insuredValue,
  perUnitCost,
  stakeOn,
} from './estimates';

/** Weights for one bot personality; scores are in G and sampled with a softmax temperature. */
export interface EconomyPersonality {
  /** Penalty per G of cargo value at risk. */
  readonly risk: number;
  /** Multiplier on pirate loot. */
  readonly aggression: number;
  /** Multiplier on a building's estimated worth. */
  readonly builder: number;
  /** Multiplier on the future value of materials kept in the warehouse. */
  readonly patience: number;
  readonly temperature: number;
}

export const ECONOMY_PERSONALITIES = {
  balanced: { risk: 0.2, aggression: 1, builder: 1, patience: 0.9, temperature: 25 },
  cautious: { risk: 0.5, aggression: 0.6, builder: 1, patience: 1, temperature: 25 },
  aggressive: { risk: 0, aggression: 1.5, builder: 0.8, patience: 0.8, temperature: 25 },
  builder: { risk: 0.2, aggression: 0.8, builder: 1.5, patience: 1, temperature: 25 },
} as const satisfies Record<string, EconomyPersonality>;
export type EconomyPersonalityName = keyof typeof ECONOMY_PERSONALITIES;

type Invest = Extract<EconomyAction, { type: 'invest' }>;
type Deploy = Extract<EconomyAction, { type: 'deploy-role' }>;

function scoreInvest(view: EconomyView, action: Invest, persona: EconomyPersonality): number {
  const { rules } = view;
  const p = arriveChance(rules, 0);
  const insured = view.me.buildings.includes('insurance') || action.build === 'insurance';
  const stock = action.build === null ? view.me.stock : subtractGoods(view.me.stock, buildingCostGoods(rules, action.build));
  const lastRound = view.round >= rules.rounds;
  let score = -shippingCost(rules, action.load);
  let cargoValue = 0;
  const shift = (m: Material) => (action.manipulate?.material === m ? action.manipulate.delta : 0);
  const brokerCost = (m: Material) => (action.manipulate?.material === m ? rules.buildings.broker.unitCost : 0);
  for (const m of MATERIALS) {
    const shipped = action.load[m];
    const price = expectedPrice(view, m, shipped, shift(m));
    const atRisk = shipped * price * (1 - p);
    const kept = 1 - seizureRisk(view, m);
    score += shipped * price * p * kept - atRisk * persona.risk * (insured ? 0.5 : 1);
    cargoValue += shipped * price;
    score += action.direct[m] * directSalePrice(view, m);
    const spoils = lastRound || rules.perishable[m] === 1;
    const keepEach = spoils ? 0 : Math.max(0, currentPrice(view, m) * p - perUnitCost(rules)) * persona.patience;
    score += (stock[m] - shipped - action.direct[m] - brokerCost(m)) * keepEach;
  }
  const shippedUnits = MATERIALS.reduce((sum, m) => sum + action.load[m], 0);
  if (insured && shippedUnits > 0) {
    score += (1 - p) * insuredValue(rules, shippedUnits, cargoValue / shippedUnits);
  }
  if (action.manipulate !== null) {
    // The own-unit price effect is already in expectedPrice; add the relative effect on rivals.
    score += shiftValue(view, action.manipulate.material, action.manipulate.delta, 0);
  }
  if (action.build !== null) {
    score += persona.builder * buildingWorth(view, action.build) - rules.buildings[action.build].cash;
  }
  return score;
}

function scoreDeploy(view: EconomyView, action: Deploy, persona: EconomyPersonality): number {
  const ship = view.ships.find((s) => s.id === action.targetShipId);
  if (action.role === null || ship === undefined) {
    return 0;
  }
  const { rules } = view;
  const stake = stakeOn(view, ship);
  const base = arriveChance(rules, 0);
  const fee = rules.roles[action.role].fee;
  switch (action.role) {
    case 'guard': {
      const boost = rules.roles.guard.rollModifier + (view.me.buildings.includes('insurance') ? rules.buildings.insurance.guardRollBonus : 0);
      const guarded = arriveChance(rules, boost);
      const escort = rules.mode === 'A' && stake === 0 ? rules.roles.guard.escortFee * guarded : 0;
      return (guarded - base) * stake + escort + expectedSeizure(view, ship) * guarded - fee;
    }
    case 'pirate': {
      const attacked = arriveChance(rules, rules.roles.pirate.modifier);
      const loot = (rules.roles.pirate.loot + (carriesWanted(view, ship) ? rules.wanted.lootBonus : 0)) * (1 - attacked);
      const salvage = view.me.buildings.includes('salvage') && stake === 0 ? (base - attacked) * averagePrice(view) * base : 0;
      return loot * persona.aggression + salvage - (base - attacked) * stake - fee;
    }
    case 'smuggler': {
      const guardedChance = 0.25;
      return base * ((1 - guardedChance) * rules.roles.smuggler.goodsValue - guardedChance * rules.roles.smuggler.caughtFine) - fee;
    }
    case 'intel':
      return stake * (1 - base) * base * 0.5 - fee;
  }
}

function score(view: EconomyView, action: EconomyAction, persona: EconomyPersonality): number {
  switch (action.type) {
    case 'invest':
      return scoreInvest(view, action, persona);
    case 'deploy-role':
      return scoreDeploy(view, action, persona);
    case 'intel-reroll': {
      const ship = view.ships.find((s) => s.id === view.myDeployment?.targetShipId);
      const wantsArrival = ship !== undefined && stakeOn(view, ship) > 0;
      const bad = view.intelRoll !== null && view.intelRoll < view.rules.sailing.successMin;
      return action.reroll === (wantsArrival && bad) ? 1 : 0;
    }
  }
}

/** Samples with probability proportional to exp(score / temperature). */
function sample(options: readonly EconomyAction[], scores: readonly number[], temperature: number, rng: Rng): EconomyAction {
  const best = Math.max(...scores);
  const weights = scores.map((s) => Math.exp((s - best) / temperature));
  let pick = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i += 1) {
    pick -= weights[i]!;
    if (pick <= 0) {
      return options[i]!;
    }
  }
  return options[options.length - 1]!;
}

export function createEconomyHeuristicBot(name: EconomyPersonalityName, seed: number): EconomyDecider {
  const persona: EconomyPersonality = ECONOMY_PERSONALITIES[name];
  const rng = createRng(seed);
  return {
    decide(view, legalActions) {
      if (legalActions.length === 0) {
        throw new Error(`${view.playerId} has no legal action in ${view.phase}`);
      }
      const scores = legalActions.map((a) => score(view, a, persona));
      return sample(legalActions, scores, persona.temperature, rng);
    },
  };
}

export function createEconomyRandomBot(seed: number): EconomyDecider {
  const rng = createRng(seed);
  return {
    decide(view, legalActions) {
      const action = legalActions[rng.int(0, Math.max(0, legalActions.length - 1))];
      if (action === undefined) {
        throw new Error(`${view.playerId} has no legal action in ${view.phase}`);
      }
      return action;
    },
  };
}
