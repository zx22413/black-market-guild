import {
  GOODS,
  buildingCost,
  cratesOn,
  createRng,
  activeTide,
  darkNight,
  facilityOf,
  pirateModifier,
  materialsOn,
  roleFee,
  shipCostFor,
  traitOf,
  type Action,
  type PlayerView,
  type ViewShip,
} from '../game';
import { choose } from './choose';
import type { LootTerms } from './estimates';
import {
  SMUGGLER_GUARDED_CHANCE,
  DIPLOMAT_HIT,
  OTHERS_LOAD_SHARE,
  arriveChance,
  expectedLoot,
  averagePrice,
  buildingWorth,
  carriesWanted,
  curveOutlook,
  expectedOwnModifier,
  currentPrice,
  expectedPrice,
  expectedSeizure,
  me,
  guessedCargoValue,
  perUnitCost,
  seizureRisk,
  stakeOn,
  isFinal,
  survivingUnits,
} from './estimates';
import { islandWorth } from './islands';
import { PERSONALITIES, type Personality, type PersonalityName } from './personality';
import type { Bot } from './types';
import { V08Cache, pirateLootCrates, scoreInvestV08 } from './v08';

type Invest = Extract<Action, { type: 'invest' }>;
type Deploy = Extract<Action, { type: 'deploy-role' }>;

function scoreInvest(view: PlayerView, action: Invest, persona: Personality): number {
  const { rules } = view;
  const player = me(view);
  const trait = traitOf(rules, player.island);
  const insured = player.buildings.includes('insurance') || action.build === 'insurance';
  const cost = action.build === null ? null : buildingCost(rules, action.build);
  const lastRound = isFinal(view);
  const shippedUnits = GOODS.reduce((sum, g) => sum + action.load[g], 0);
  let score = shippedUnits > 0 ? -shipCostFor(rules, player.island, action.shipType, action.load) : 0;
  // Experiment (rules.ships): the ship type's payout curve replaces the plain arrive-or-sink odds.
  const typed = action.shipType === undefined ? null : rules.ships.types[action.shipType];
  const outlook = action.shipType === undefined ? null : curveOutlook(rules, action.shipType, expectedOwnModifier(view, trait.ownShipModifier, rules.ships.types[action.shipType].delay > 0), trait.ownShipFinalCap);
  const p = outlook === null ? arriveChance(rules, trait.ownShipModifier) : 1 - outlook.sink;
  // What a unit kept for a later voyage is worth must not depend on this voyage's ship type.
  // With ship types a later unit earns the standard ship's share of its value, not a plain arrival.
  const keepP = outlook === null ? arriveChance(rules, trait.ownShipModifier) : curveOutlook(rules, 'standard', expectedOwnModifier(view, trait.ownShipModifier), trait.ownShipFinalCap).income;
  const keepCost = outlook === null ? perUnitCost(rules) : 0;
  let cargoValue = 0;
  for (const g of GOODS) {
    const shipped = action.load[g];
    const price = expectedPrice(view, g, shipped);
    const atRisk = shipped * price * (1 - p);
    if (outlook !== null && typed !== null) {
      const seized = typed.secret === 1 ? 0 : seizureRisk(g);
      score += shipped * price * outlook.income * (1 - seized) - shipped * price * outlook.sink * persona.risk * (insured ? 0.5 : 1);
    } else {
      score += shipped * price * p * (1 - seizureRisk(g)) - atRisk * persona.risk * (insured ? 0.5 : 1);
    }
    cargoValue += shipped * price;
    // §6.3: spice spoils at round end (Spice Isles excepted); leftovers are worthless after round 6.
    const spoils = lastRound || (g === 'spice' && trait.keepsSpice !== 1);
    const keepEach = spoils ? 0 : Math.max(0, currentPrice(view, g) * keepP - keepCost) * persona.patience;
    // V0.8 prototype (暗潮將至): only what survives the round's warehouse loss is worth keeping.
    score += survivingUnits(view, view.myStock[g] - (cost?.[g] ?? 0) - shipped) * keepEach;
  }
  if (insured && shippedUnits > 0) {
    score += (1 - p) * rules.buildings.insurance.payout;
  }
  if (action.build !== null) {
    score += persona.builder * buildingWorth(view, action.build) - rules.buildings.costs[action.build].cash;
  }
  return score;
}

/** The ship a deployment aims at: one in this round's voyage, or a freighter still at sea (its cargo is secret, game-design.md §8.1). */
function targetShip(view: PlayerView, id: string | null): ViewShip | undefined {
  const ship = view.ships.find((s) => s.id === id);
  if (ship !== undefined) return ship;
  const sea = view.transit.find((s) => s.id === id && s.arriveRound > view.round);
  return sea === undefined ? undefined : { id: sea.id, owner: sea.owner, type: sea.type, outcome: null, cargo: null };
}

/**
 * The diplomat guesses which role an opponent aims at its own ship. A right
 * guess saves part of what that role would take and wins `take` G; a wrong one gets part of the fee back.
 */
function scoreDiplomat(view: PlayerView, action: Deploy): number {
  const { rules } = view;
  const ship = targetShip(view, action.targetShipId);
  const guess = action.guessRole;
  if (ship === undefined || guess === undefined || guess === null) {
    return 0;
  }
  const fee = roleFee(rules, me(view).island, 'diplomat');
  const hit = DIPLOMAT_HIT[guess] ?? 0;
  const stake = stakeOn(view, ship);
  const saved = guess === 'pirate' ? stake * 0.3 : guess === 'smuggler' ? rules.roles.smuggler.goodsValue * 0.7 : guess === 'customs' ? stake * 0.25 : 0;
  const { take, refundPercent } = rules.roles.diplomat;
  return -fee + (1 - hit) * fee * (refundPercent / 100) + hit * (saved + take);
}

/** V0.8 prototype: 海盜潮's arrival loot and the target owner's armory halving every take (v08.armory.halveAllLoot). */
function lootTerms(view: PlayerView, ship: ViewShip): LootTerms {
  const { rules } = view;
  const owner = view.players.find((p) => p.id === ship.owner);
  const armory = owner !== undefined && facilityOf(rules, owner) === 'armory';
  const halved = rules.v08.armory.halveAllLoot === 1 && armory;
  // v08.armory.immunePirateTide: the owner's armory shields its ships from 海盜潮's arrival loot.
  const shielded = armory && rules.v08.armory.immunePirateTide === 1;
  const arrivalPercent = activeTide(view.events) === 'pirate' && !shielded ? rules.v08.events.tidePirateArrivalLoot : 0;
  return { arrivalPercent, halved };
}

function scoreDeploy(view: PlayerView, action: Deploy, persona: Personality, cache: V08Cache): number {
  if (action.role === 'diplomat') {
    return scoreDiplomat(view, action);
  }
  const ship = targetShip(view, action.targetShipId);
  if (action.role === null || ship === undefined) {
    return 0;
  }
  const { rules } = view;
  const player = me(view);
  const trait = traitOf(rules, player.island);
  const stake = stakeOn(view, ship);
  const base = arriveChance(rules, 0);
  const fee = roleFee(rules, player.island, action.role);
  // V0.8 prototype (v08.events): a phase II moonless night voids guards and the owner's own smuggler cover.
  const dark = darkNight(view.events, view.voyageEvent);
  switch (action.role) {
    case 'guard': {
      if (dark) return -fee;
      const guarded = arriveChance(rules, rules.roles.guard.modifier + trait.guardModifier);
      return (guarded - base) * stake - fee;
    }
    case 'pirate': {
      // V0.8 prototype (海盜伏擊): a phase II sea fog strengthens every pirate.
      const modifier = pirateModifier(rules, view.events, view.voyageEvent) + trait.pirateModifier;
      const attacked = arriveChance(rules, modifier);
      const bonus = carriesWanted(view, ship) ? rules.wanted.lootBonus : 0;
      // v08.botPirateCrates: crate tables and the active tide instead of the V0.7 percent curves.
      const loot =
        rules.v08.botPirateCrates === 1 && cratesOn(rules)
          ? pirateLootCrates(view, ship, modifier, bonus, cache)
          : expectedLoot(rules, modifier, guessedCargoValue(view, ship), bonus, lootTerms(view, ship));
      const salvage = player.buildings.includes('salvage') && stake === 0 ? (base - attacked) * averagePrice(view) * base : 0;
      return loot * persona.aggression + salvage - (base - attacked) * stake - fee;
    }
    case 'smuggler': {
      if (ship.owner === view.playerId) {
        if (dark) return -fee;
        // §9.5: covering my own ship; worth it for the share of its cargo customs might name (the smuggler port cannot cover arms).
        return stake * 0.15 * base * (trait.armsUncoverable === 1 ? 0.5 : 1) - fee;
      }
      const { goodsValue, fine } = rules.roles.smuggler;
      return base * ((1 - SMUGGLER_GUARDED_CHANCE) * goodsValue - SMUGGLER_GUARDED_CHANCE * fine) - fee;
    }
    case 'customs':
      return expectedSeizure(view, ship, action.namedGood ?? 'arms') * base - fee;
  }
}

export function scoreAction(view: PlayerView, action: Action, persona: Personality, cache: V08Cache = new V08Cache()): number {
  switch (action.type) {
    case 'choose-island':
      return islandWorth(view, action.island, persona);
    case 'invest':
      // V0.8 prototype (rules.v08): material actions and crate voyages have their own scoring.
      return materialsOn(view.rules) || view.rules.v08.crates === 1 ? scoreInvestV08(view, action, persona, cache) : scoreInvest(view, action, persona);
    case 'deploy-role':
      return scoreDeploy(view, action, persona, cache);
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
      const cache = new V08Cache();
      const scores = legalActions.map((a) => scoreAction(view, a, persona, cache));
      return choose(legalActions, scores, persona.temperature, rng);
    },
  };
}
