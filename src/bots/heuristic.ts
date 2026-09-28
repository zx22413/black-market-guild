import { createRng, type Action, type MatchEvent, type PlayerId, type PlayerView, type PublicShip } from '../game';
import { choose, type Scored } from './choose';
import {
  arriveWith,
  cashOf,
  holds,
  jointValue,
  marketModifier,
  shipTotalIncome,
  soloValue,
} from './estimates';
import { BotMemory } from './memory';
import { PERSONALITIES, type Personality, type PersonalityName } from './personality';
import type { Bot, DecisionContext } from './types';

interface Scope {
  readonly view: PlayerView;
  readonly self: PlayerId;
  readonly p: Personality;
  readonly memory: BotMemory;
}

const opponents = ({ view, self }: Scope) => view.players.map((pl) => pl.id).filter((id) => id !== self);

function averageTrust(scope: Scope): number {
  const others = opponents(scope);
  return others.reduce((sum, id) => sum + scope.memory.trust(id, scope.p.grudge), 0) / Math.max(1, others.length);
}

// ── Assets (game-design.md §8) ────────────────────────────────────────────────

function assetScore(scope: Scope, asset: 'shipyard' | 'insurance' | 'salvage' | 'exchange'): number {
  const { view, p, self } = scope;
  const { assets } = view.rules;
  const remaining = view.totalRounds - view.round + 1;
  const likelyShips = Math.min(2, 0.5 * (view.players.length - 1));
  const perRound = {
    shipyard: assets.shipyard.costReduction,
    insurance: assets.insurance.payout * 0.5,
    salvage: assets.salvage.payout * likelyShips,
    exchange: assets.exchange.payout * likelyShips,
  }[asset];
  const price = assets[asset].price;
  const cashAfter = cashOf(view, self) - price;
  const reservePenalty = Math.max(0, p.cashReserve - cashAfter);
  return perRound * remaining * p.assetEagerness - price * (1 - view.rules.assetValueRatio) - reservePenalty;
}

// ── Joint ventures and sailing (game-design.md §6) ────────────────────────────

function recruitScore(scope: Scope, recruit: boolean): number {
  const { view, self, p } = scope;
  const solo = soloValue(view, self);
  const joint = jointValue(view, self, self) * averageTrust(scope);
  return recruit ? joint + p.recruitBias : solo + Math.max(0, joint - solo) * 0.5;
}

/**
 * Value of keeping one's own recruitment open: the chance at least one non-recruiter applies,
 * times the joint value, otherwise the solo fallback.
 */
function keepRecruitingScore(scope: Scope): number {
  const { view, self } = scope;
  const recruiters = view.recruitment.recruiters.length;
  const others = view.players.length - recruiters;
  const someoneApplies = 1 - (1 - 0.5 / Math.max(1, recruiters)) ** others;
  const solo = soloValue(view, self);
  return someoneApplies * jointValue(view, self, self) * averageTrust(scope) + (1 - someoneApplies) * solo;
}

function applyScore(scope: Scope, recruiter: PlayerId | null): number {
  const { view, self, p, memory } = scope;
  if (recruiter === null) {
    return view.recruitment.recruiters.includes(self) ? keepRecruitingScore(scope) : soloValue(view, self);
  }
  return jointValue(view, self, recruiter) * memory.trust(recruiter, p.grudge) - cheatRisk(scope, recruiter);
}

/** Expected loss from a partner who might smuggle on the shared ship. */
function cheatRisk(scope: Scope, partner: PlayerId): number {
  return scope.memory.smuggleRate(partner, 0.1) * scope.view.rules.roles.smuggler.goodsValue * 0.25;
}

function pickScore(scope: Scope, applicant: PlayerId | null): number {
  const { view, self, p, memory } = scope;
  if (applicant === null) {
    return soloValue(view, self);
  }
  return jointValue(view, self, self) * memory.trust(applicant, p.grudge) - cheatRisk(scope, applicant);
}

function sailScore(scope: Scope, solo: boolean): number {
  if (!solo) {
    return 0;
  }
  const pirateRisk = opponents(scope).reduce((s, id) => s + scope.memory.pirateRate(id, scope.p.expectedPirateRate), 0);
  return soloValue(scope.view, scope.self) * (1 - Math.min(0.6, 0.15 * pirateRisk));
}

// ── Roles (game-design.md §7) ─────────────────────────────────────────────────

interface ShipOutlook {
  readonly ship: PublicShip;
  readonly mine: boolean;
  readonly myShare: number;
  readonly attackers: number;
  readonly guardChance: number;
  readonly smuggleChance: number;
}

function outlook(scope: Scope, ship: PublicShip): ShipOutlook {
  const { view, self, p, memory } = scope;
  const ships = view.ships;
  const attackers = opponents(scope)
    .filter((id) => !ship.owners.includes(id))
    .reduce((sum, id) => {
      const targets = ships.filter((s) => !s.owners.includes(id)).length;
      return sum + memory.pirateRate(id, p.expectedPirateRate) / Math.max(1, targets);
    }, 0);
  const others = ship.owners.filter((id) => id !== self);
  const income = shipTotalIncome(view, ship.kind, ship.recruiters);
  return {
    ship,
    mine: ship.owners.includes(self),
    myShare: ship.owners.includes(self) ? income / ship.owners.length : 0,
    attackers,
    guardChance: Math.min(
      1,
      ship.owners.reduce((s, id) => s + memory.guardOwnShipRate(id, 0.3), 0) +
        view.players
          .map((pl) => pl.id)
          .filter((id) => !ship.owners.includes(id))
          .reduce((s, id) => s + memory.guardOtherShipRate(id, 0.05) / Math.max(1, ships.length - 1), 0),
    ),
    smuggleChance: ship.kind === 'joint' ? Math.min(1, others.reduce((s, id) => s + memory.smuggleRate(id, 0.1), 0)) : 0,
  };
}

function lootPool(view: PlayerView): number {
  const bounty = view.marketEvent === 'black-market-bounty' ? view.rules.marketEvents.blackMarketBountyBonus : 0;
  return view.rules.roles.pirate.loot + bounty;
}

function roleScore(scope: Scope, action: Extract<Action, { type: 'deploy-role' }>): number {
  const { view, self, p } = scope;
  if (action.role === null) {
    return 0;
  }
  const ship = view.ships.find((s) => s.id === action.targetShipId);
  if (ship === undefined) {
    return -Infinity;
  }
  const o = outlook(scope, ship);
  const { rules } = view;
  const base = arriveWith(view, 0, 0);
  const underAttack = arriveWith(view, 0, 1);
  const attackChance = Math.min(1, o.attackers);
  const fee = rules.roles[action.role].fee;
  const goods = rules.roles.smuggler.goodsValue;
  switch (action.role) {
    case 'intel': {
      const salvage = holds(view, self, 'salvage') ? 0.25 * rules.assets.salvage.payout : 0;
      return (o.mine ? 0.25 * o.myShare : salvage) - fee;
    }
    case 'guard': {
      const lift =
        attackChance * (arriveWith(view, 1, 1) - underAttack) + (1 - attackChance) * (arriveWith(view, 1, 0) - base);
      const protection = o.mine ? lift * o.myShare : 0;
      return protection + o.smuggleChance * goods * base - fee;
    }
    case 'pirate': {
      const sinkChance = o.guardChance * (1 - arriveWith(view, 1, 1)) + (1 - o.guardChance) * (1 - underAttack);
      const gain = sinkChance * (lootPool(view) + o.smuggleChance * goods) - fee;
      if (!o.mine) {
        return gain + (p.aggression - 1) * 50;
      }
      const ownLoss = (sinkChance - (1 - base)) * o.myShare;
      return gain - ownLoss + (p.betrayal - 1) * 100;
    }
    case 'smuggler': {
      const caught = Math.min(
        1,
        ship.owners.filter((id) => id !== self).reduce((s, id) => s + scope.memory.guardOwnShipRate(id, 0.3), 0) +
          opponents(scope)
            .filter((id) => !ship.owners.includes(id))
            .reduce((s, id) => s + scope.memory.guardOtherShipRate(id, 0.05) / Math.max(1, view.ships.length - 1), 0),
      );
      const arrive = attackChance * underAttack + (1 - attackChance) * base;
      // Stealing from one's own joint ship costs one's own share of the goods.
      const gain = o.mine ? goods - goods / ship.owners.length : goods;
      const reputation = rules.roles.smuggler.anonymous === 1 ? caught * 40 : 20;
      return (1 - caught) * arrive * gain * p.smuggling - fee - reputation;
    }
  }
}

function rerollScore(scope: Scope, reroll: boolean): number {
  const { view, self } = scope;
  const intel = view.intel;
  if (intel === null) {
    return reroll ? -1 : 0;
  }
  const ship = view.ships.find((s) => s.id === intel.shipId);
  const expectedArrival = intel.rawRoll + marketModifier(view) >= view.rules.sailing.successMin;
  const wantsArrival = ship?.owners.includes(self) ?? false;
  const sabotage = !wantsArrival && holds(view, self, 'salvage');
  const shouldReroll = wantsArrival ? !expectedArrival : sabotage && expectedArrival;
  return reroll === shouldReroll ? 100 : 0;
}

// ── Assembly ──────────────────────────────────────────────────────────────────

function score(scope: Scope, action: Action): number {
  switch (action.type) {
    case 'buy-asset':
      return action.asset === null ? 0 : assetScore(scope, action.asset);
    case 'recruit':
      return recruitScore(scope, action.recruit);
    case 'apply':
      return applyScore(scope, action.recruiterId);
    case 'pick':
      return pickScore(scope, action.applicantId);
    case 'choose-sailing':
      return sailScore(scope, action.choice === 'solo');
    case 'deploy-role':
      return roleScore(scope, action);
    case 'intel-reroll':
      return rerollScore(scope, action.reroll);
  }
}

/**
 * Expected-value bot with a personality. It sees only its DecisionContext and remembers
 * public events, trusting players less after they attack or cheat ships it sails on.
 */
export function createHeuristicBot(personality: Personality | PersonalityName, seed: number): Bot {
  const p = typeof personality === 'string' ? PERSONALITIES[personality] : personality;
  const rng = createRng(seed);
  const memory = new BotMemory();
  let self: PlayerId | null = null;
  let backlog: MatchEvent[] = [];
  return {
    decide(context: DecisionContext): Action {
      if (self === null) {
        self = context.view.playerId;
        memory.observe(backlog, self);
        backlog = [];
      }
      const scope: Scope = { view: context.view, self, p, memory };
      const options: Scored[] = context.legalActions.map((action) => ({ action, score: score(scope, action) }));
      return choose(options, p.temperature, rng);
    },
    onEvents(events) {
      if (self === null) {
        backlog = [...backlog, ...events];
      } else {
        memory.observe(events, self);
      }
    },
  };
}
