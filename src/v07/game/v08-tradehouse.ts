import { changeCash, chain, playerOf, type StepFn } from './cash';
import { priceAt } from './goods';
import type { Rules } from './rules';
import { GOODS, type GoodId, type Goods, type MatchEvent, type MatchState, type PlayerState } from './types';
import { facilityOf } from './v08';

// V0.8 simulation prototype, the tradehouse without naming a good (docs/proposals/2026-11-playtest-feedback-and-direction.md
// §10.14): 老字號 (premiumCrates: the owner's highest-priced arriving crates sell a cell higher) and 收購剩貨
// (buyoutPercent: at the end of each round the tradehouse buys the owner's highest-priced warehouse crate at that share
// of its price). With buyoutChosen (the official V0.8 rule since 2026-11-24) the owner names that crate or none.
// With every switch at 0 nothing changes.

const ownsTradehouse = (rules: Rules, player: Pick<PlayerState, 'facility'>): boolean => facilityOf(rules, player) === 'tradehouse';

/**
 * 老字號: the crates of `sold` that sell a cell higher, highest sale price first (`priceOf` = the owner's sale price of
 * one crate); empty when the switch is off or the owner has no tradehouse.
 */
export function premiumCrates(rules: Rules, owner: Pick<PlayerState, 'facility'>, sold: Goods, priceOf: (good: GoodId) => number): GoodId[] {
  const count = rules.v08.tradehouse.premiumCrates;
  if (count <= 0 || !ownsTradehouse(rules, owner)) return [];
  const crates = GOODS.flatMap((g) => Array.from({ length: sold[g] }, () => g));
  return [...crates].sort((a, b) => priceOf(b) - priceOf(a)).slice(0, count);
}

/** 收購剩貨: the good the tradehouse takes, the one it pays most for (current price breaks ties), or null when empty. */
function priciest(state: MatchState, stock: Goods): GoodId | null {
  const held = GOODS.filter((g) => stock[g] > 0);
  if (held.length === 0) return null;
  const { buyoutFloor, buyoutFixed } = state.rules.v08.tradehouse;
  const current = (g: GoodId) => priceAt(state.rules, g, state.prices[g]);
  // buyoutFixed: the same price for any crate, so the cheapest one goes (the owner keeps what sells best).
  if (buyoutFixed > 0) return held.reduce((best, g) => (current(g) < current(best) ? g : best));
  const worth = (g: GoodId) => (buyoutFloor === 1 ? priceAt(state.rules, g, 0) * 10_000 : 0) + current(g);
  return held.reduce((best, g) => (worth(g) > worth(best) ? g : best));
}

/**
 * 收購剩貨: the crate the tradehouse takes from `player`. With v08.tradehouse.buyoutChosen (buyoutFixed only) it is the
 * one the owner named in the invest submission, or none; otherwise the tradehouse picks it on its own.
 */
function takenGood(state: MatchState, player: PlayerState): GoodId | null {
  const { buyoutChosen, buyoutFixed } = state.rules.v08.tradehouse;
  if (buyoutChosen !== 1 || buyoutFixed <= 0) return priciest(state, player.stock);
  const named = state.roundState.sell?.[player.id];
  // The crate stayed in the warehouse since it was named (nothing takes from the warehouse before this step).
  return named !== undefined && player.stock[named] > 0 ? named : null;
}

/** 收購剩貨: each tradehouse owner sells one crate of the warehouse's most valuable good to the tradehouse (before spice spoils). */
export const buyLeftover: StepFn = (state) => {
  const { buyoutPercent: percent, buyoutFloor, buyoutFixed } = state.rules.v08.tradehouse;
  if (percent <= 0 && buyoutFloor !== 1 && buyoutFixed <= 0) return { state, events: [] };
  // buyoutFixed, else the lowest cell of the good's track (buyoutFloor), else buyoutPercent of its current price.
  const offer = (s: MatchState, good: GoodId): number =>
    buyoutFixed > 0 ? buyoutFixed : buyoutFloor === 1 ? priceAt(s.rules, good, 0) : Math.floor((priceAt(s.rules, good, s.prices[good]) * percent) / 100);
  const steps = state.players.flatMap((p): StepFn[] => {
    if (!ownsTradehouse(state.rules, p)) return [];
    const good = takenGood(state, p);
    if (good === null) return [];
    return [
      (s) => {
        const value = offer(s, good);
        const player = playerOf(s, p.id);
        const taken: MatchState = { ...s, players: s.players.map((q) => (q.id === p.id ? { ...q, stock: { ...player.stock, [good]: player.stock[good] - 1 } } : q)) };
        const report: MatchEvent = { type: 'v08-effect', round: s.round, playerId: p.id, shipId: null, effect: 'tradehouse-buyout', crates: 1, value };
        const bought: MatchEvent = { type: 'leftover-bought', round: s.round, playerId: p.id, good, value };
        const paid = value > 0 ? changeCash(taken, p.id, value, 'tradehouse-buyout', null) : { state: taken, events: [] };
        return { state: paid.state, events: [report, bought, ...paid.events] };
      },
    ];
  });
  return chain(state, steps);
};
