import type { Rules } from './rules';
import { GOODS, type GoodId, type Goods } from './types';

export function mapGoods(fn: (good: GoodId) => number): Goods {
  return { wood: fn('wood'), iron: fn('iron'), spice: fn('spice'), arms: fn('arms') };
}

export const NO_GOODS: Goods = mapGoods(() => 0);

export function only(good: GoodId, amount: number): Goods {
  return mapGoods((g) => (g === good ? amount : 0));
}

export function addGoods(a: Goods, b: Goods): Goods {
  return mapGoods((g) => a[g] + b[g]);
}

export function subtractGoods(a: Goods, b: Goods): Goods {
  return mapGoods((g) => a[g] - b[g]);
}

export function units(goods: Goods): number {
  return GOODS.reduce((sum, g) => sum + goods[g], 0);
}

export function covers(have: Goods, need: Goods): boolean {
  return GOODS.every((g) => have[g] >= need[g]);
}

/** Every way to take at most `total` units from `limit`, starting with nothing. */
export function enumerateGoods(limit: Goods, total: number): Goods[] {
  const walk = (index: number, left: number, picked: Goods): Goods[] => {
    const good = GOODS[index];
    if (good === undefined) {
      return [picked];
    }
    const options: Goods[] = [];
    for (let n = 0; n <= Math.min(limit[good], left); n += 1) {
      options.push(...walk(index + 1, left - n, { ...picked, [good]: n }));
    }
    return options;
  };
  return walk(0, total, NO_GOODS);
}

/** Price of one unit of `good` at a cell of its price track (§7.1). */
export function priceAt(rules: Rules, good: GoodId, step: number): number {
  const track = rules.price.tracks[good];
  return track.base + track.step * step;
}

/** §7.3: below demand rises, above falls, by the good's volatility; clamped to the track. */
export function nextPriceStep(rules: Rules, good: GoodId, step: number, arrived: number, demand: number): number {
  const delta = (arrived < demand ? 1 : arrived > demand ? -1 : 0) * rules.price.volatility[good];
  return Math.min(rules.price.steps - 1, Math.max(0, step + delta));
}
