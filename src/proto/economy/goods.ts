import type { EconomyRules } from './rules';
import { MATERIALS, type Goods, type Material } from './types';

export function mapGoods(fn: (material: Material) => number): Goods {
  return Object.fromEntries(MATERIALS.map((m) => [m, fn(m)])) as Record<Material, number>;
}

export const NO_GOODS: Goods = mapGoods(() => 0);

/** Goods with only `material` set. */
export function only(material: Material, amount: number): Goods {
  return mapGoods((m) => (m === material ? amount : 0));
}

/** Every way to take at most `total` units from `limit`, starting with nothing. */
export function enumerateGoods(limit: Goods, total: number): Goods[] {
  const walk = (index: number, left: number, picked: Goods): Goods[] => {
    const material = MATERIALS[index];
    if (material === undefined) {
      return [picked];
    }
    const options: Goods[] = [];
    for (let n = 0; n <= Math.min(limit[material], left); n += 1) {
      options.push(...walk(index + 1, left - n, { ...picked, [material]: n }));
    }
    return options;
  };
  return walk(0, total, NO_GOODS);
}

export function addGoods(a: Goods, b: Goods): Goods {
  return mapGoods((m) => a[m] + b[m]);
}

export function subtractGoods(a: Goods, b: Goods): Goods {
  return mapGoods((m) => a[m] - b[m]);
}

export function sumGoods(list: readonly Goods[]): Goods {
  return list.reduce(addGoods, NO_GOODS);
}

export function units(goods: Goods): number {
  return MATERIALS.reduce((sum, m) => sum + goods[m], 0);
}

export function covers(have: Goods, need: Goods): boolean {
  return MATERIALS.every((m) => have[m] >= need[m]);
}

/** Price of one unit at a price-track step. */
export function priceAt(rules: EconomyRules, step: number): number {
  return rules.price.base + rules.price.step * step;
}

/**
 * Arrivals below demand raise the step, above demand lower it, by the material's volatility;
 * clamped to the track. A material with no demand and no arrivals keeps its price.
 */
export function nextPriceStep(rules: EconomyRules, material: Material, step: number, arrived: number, demand: number): number {
  const delta = (arrived < demand ? 1 : arrived > demand ? -1 : 0) * rules.price.volatility[material];
  return Math.min(rules.price.steps - 1, Math.max(0, step + delta));
}
