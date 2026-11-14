import { covers, NO_GOODS, priceAt, subtractGoods } from './goods';
import { shipIncomePercent, shipSinks, type Rules } from './rules';
import {
  GOODS,
  SHIP_TYPE_IDS,
  V08_BUILDING_IDS,
  type GoodId,
  type Goods,
  type IslandId,
  type MaterialAction,
  type PlayerState,
  type ShipTypeId,
  type V08BuildingId,
} from './types';

// V0.8 simulation prototype (v08-rules.ts): crate-count voyages, ship skills, buildings bought with materials and
// island variants. NOT rules: every function here is a no-op unless a rules.v08 switch is 1.

export const cratesOn = (rules: Rules): boolean => rules.v08.crates === 1;
export const skillsOn = (rules: Rules): boolean => rules.v08.skills === 1;
export const buildingsOn = (rules: Rules): boolean => rules.v08.buildings === 1;
export const materialsOn = (rules: Rules): boolean => skillsOn(rules) || buildingsOn(rules);
export const v08On = (rules: Rules): boolean => cratesOn(rules) || materialsOn(rules);
const variantsOn = (rules: Rules): boolean => rules.v08.islandVariants === 1;

/** The level (0 = not opened) of a player's skill for a ship type. */
export function skillLevel(rules: Rules, player: Pick<PlayerState, 'skills'>, type: ShipTypeId): number {
  return skillsOn(rules) ? (player.skills?.[type] ?? 0) : 0;
}

export function facilityOf(rules: Rules, player: Pick<PlayerState, 'facility'>): V08BuildingId | null {
  return buildingsOn(rules) ? (player.facility ?? null) : null;
}

/** An island variant: the island's extra effect when its owner holds the building. */
export function hasVariant(rules: Rules, island: IslandId | null, facility: V08BuildingId | null, want: IslandId, building: V08BuildingId): boolean {
  return variantsOn(rules) && island === want && facility === building;
}

export function materialCost(rules: Rules, material: MaterialAction): Goods {
  switch (material.kind) {
    case 'open':
      return rules.v08.costs.open;
    case 'upgrade':
      return rules.v08.costs.upgrade;
    case 'build':
      return rules.v08.costs.build[material.building];
  }
}

/** Every material action the player can take and pay for from the warehouse. */
export function materialOptions(rules: Rules, player: PlayerState): MaterialAction[] {
  const skills = player.skills ?? {};
  const opened = SHIP_TYPE_IDS.filter((t) => (skills[t] ?? 0) > 0);
  const options: MaterialAction[] = [];
  if (skillsOn(rules)) {
    if (opened.length < rules.v08.maxSkills) {
      SHIP_TYPE_IDS.filter((t) => !opened.includes(t)).forEach((ship) => options.push({ kind: 'open', ship }));
    }
    if (rules.v08.levelUp.byLaunches === 0) {
      opened.filter((t) => (skills[t] ?? 0) < rules.v08.maxLevel).forEach((ship) => options.push({ kind: 'upgrade', ship }));
    }
  }
  if (buildingsOn(rules) && player.facility === undefined && rules.v08.maxBuildings > 0) {
    V08_BUILDING_IDS.forEach((building) => options.push({ kind: 'build', building }));
  }
  return options.filter((m) => covers(player.stock, materialCost(rules, m)));
}

/** The player after paying for and taking a material action. */
export function applyMaterial(rules: Rules, player: PlayerState, material: MaterialAction): PlayerState {
  const stock = subtractGoods(player.stock, materialCost(rules, material));
  if (material.kind === 'build') {
    return { ...player, stock, facility: material.building };
  }
  const level = (player.skills?.[material.ship] ?? 0) + 1;
  return { ...player, stock, skills: { ...player.skills, [material.ship]: level } };
}

/**
 * V0.8 prototype (v08.levelUp): the player after launching a ship of `type`. An opened skill counts the launch, and
 * reaches the next level once the count passes `byLaunches` (so launch N + 1 already sails at level 2).
 */
export function practiced(rules: Rules, player: PlayerState, type: ShipTypeId): { readonly player: PlayerState; readonly leveled: boolean } {
  const { byLaunches } = rules.v08.levelUp;
  const level = skillLevel(rules, player, type);
  if (byLaunches === 0 || level === 0) return { player, leveled: false };
  const count = (player.practice?.[type] ?? 0) + 1;
  const leveled = level < rules.v08.maxLevel && count > byLaunches;
  return {
    player: { ...player, practice: { ...player.practice, [type]: count }, ...(leveled ? { skills: { ...player.skills, [type]: level + 1 } } : {}) },
    leveled,
  };
}

/** Hidden 「私貨艙」: private crates a hidden ship may carry at this skill level. */
export function privateCapacity(rules: Rules, level: number): number {
  return level >= 2 ? rules.v08.hidden.privateL2 : level === 1 ? rules.v08.hidden.privateL1 : 0;
}

/** Freighter 「拾荒」: crates taken from each other player's sunk ship. */
export function salvageCount(rules: Rules, level: number): number {
  return level >= 2 ? rules.v08.freighter.salvageL2 : level === 1 ? rules.v08.freighter.salvageL1 : 0;
}

/** Breaker 「巨浪」: the lowest raw die that rolls one more d6 (Infinity = the skill is not open). */
export function extraDieFrom(rules: Rules, level: number): number {
  return level >= 2 ? rules.v08.breaker.extraFromL2 : level === 1 ? rules.v08.breaker.extraFromL1 : Number.POSITIVE_INFINITY;
}

/** Standard 「好兆頭」: whether a voyage with this outcome rerolls (level 1: it would sink; level 2: final ≤ the threshold). */
export function rerolls(rules: Rules, level: number, sinks: boolean, final: number): boolean {
  return level >= 2 ? sinks || final <= rules.v08.standard.rerollAtMostL2 : level === 1 ? sinks : false;
}

/** A crate table entry: the listed key nearest to `final`. */
function lookup(table: Readonly<Record<number, number>>, final: number): number {
  const keys = Object.keys(table).map(Number);
  const key = Math.min(Math.max(...keys), Math.max(Math.min(...keys), final));
  return table[key] ?? 0;
}

export interface CrateContext {
  readonly raised: boolean;
  /** The owner's skill level for the ship's type. */
  readonly level: number;
  readonly facility: V08BuildingId | null;
  readonly island: IslandId | null;
}

/** What a voyage pays at a final value: whether it sinks, crates lost, and the percent of the arrived crates' value. */
export interface CrateTerms {
  readonly sinks: boolean;
  readonly lose: number;
  readonly percent: number;
}

/** A ship type can sink when any entry of its table sinks. */
function canSink(rules: Rules, type: ShipTypeId): boolean {
  return Object.values(rules.v08.tables[type].lose).some((n) => n < 0);
}

/** The voyage terms at a final value; with every switch off, the V0.7.1 curves (nothing lost). */
export function crateTerms(rules: Rules, type: ShipTypeId, final: number, context: CrateContext): CrateTerms {
  if (context.raised) {
    const { minFinal, multiplier, multiplierL2 } = rules.v08.raise;
    return { sinks: final < minFinal, lose: 0, percent: context.level >= 2 ? multiplierL2 : multiplier };
  }
  if (!cratesOn(rules)) {
    return { sinks: shipSinks(rules, type, final), lose: 0, percent: shipIncomePercent(rules, type, final) };
  }
  const table = rules.v08.tables[type];
  const base = lookup(table.lose, final);
  if (base < 0) {
    return { sinks: true, lose: 0, percent: 0 };
  }
  const { fromFinal, toFinal, save } = rules.v08.repairyard;
  const repaired =
    context.facility === 'repairyard' &&
    base >= 1 &&
    final <= toFinal &&
    ((canSink(rules, type) && final >= fromFinal) || hasVariant(rules, context.island, context.facility, 'lumber', 'repairyard'));
  return { sinks: false, lose: repaired ? Math.max(0, base - save) : base, percent: lookup(table.multiplier, final) };
}

/** Crates saved by the repairyard at this final (0 when it does not apply), for the report. */
export function repairyardSaved(rules: Rules, type: ShipTypeId, final: number, context: CrateContext): number {
  if (!cratesOn(rules) || context.raised || context.facility !== 'repairyard') return 0;
  const without = crateTerms(rules, type, final, { ...context, facility: null });
  const withIt = crateTerms(rules, type, final, context);
  return without.sinks ? 0 : without.lose - withIt.lose;
}

/** Goods ordered by their current market price, highest first (ties in good order). */
export function byPriceDesc(rules: Rules, prices: Goods): GoodId[] {
  return [...GOODS].sort((a, b) => priceAt(rules, b, prices[b]) - priceAt(rules, a, prices[a]) || GOODS.indexOf(a) - GOODS.indexOf(b));
}

/** `count` crates taken from `cargo`, highest current price first (ties in good order); never more than aboard. */
export function takeHighest(rules: Rules, cargo: Goods, count: number, prices: Goods): Goods {
  let left = count;
  const taken: Record<GoodId, number> = { ...NO_GOODS };
  for (const good of byPriceDesc(rules, prices)) {
    const n = Math.min(left, cargo[good]);
    taken[good] = n;
    left -= n;
  }
  return taken;
}

/** Tradehouse: the goods whose own arriving crates keep the pre-change price if it drops (spice isles: spice too). */
export function protectedGoods(rules: Rules, island: IslandId | null, facility: V08BuildingId | null, named: GoodId | undefined): GoodId[] {
  if (facility !== 'tradehouse') return [];
  const spice = hasVariant(rules, island, facility, 'spice-isles', 'tradehouse') ? (['spice'] as GoodId[]) : [];
  return [...new Set([...(named === undefined ? [] : [named]), ...spice])];
}
