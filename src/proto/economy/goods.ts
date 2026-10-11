import type { EconomyRules } from './rules';
import { MATERIALS, type Goods, type Material } from './types';

export const NO_GOODS: Goods = { wood: 0, iron: 0 };

export function mapGoods(fn: (material: Material) => number): Goods {
  return { wood: fn('wood'), iron: fn('iron') };
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

/** Arrivals below demand raise the step, above demand lower it; clamped to the track. */
export function nextPriceStep(rules: EconomyRules, step: number, arrived: number, demand: number): number {
  const delta = arrived < demand ? 1 : arrived > demand ? -1 : 0;
  return Math.min(rules.price.steps - 1, Math.max(0, step + delta));
}
