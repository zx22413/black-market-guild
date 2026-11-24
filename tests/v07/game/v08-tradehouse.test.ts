import { describe, expect, it } from 'vitest';
import { RULES_V07, RULES_V08, getLegalActions, priceAt, type Action, type MatchEvent, type MatchState, type Rules } from '../../../src/v07/game';
import { G, cash, edit, find, plain, playRound, withDemand } from './helpers';

// V0.8 simulation prototype, the tradehouse without naming (v08.tradehouse.named / premiumCrates / buyoutPercent;
// playtest notes §10.14). NOT rules. The event deck is off so the round's card is the neutral one.

const base: Rules = { ...RULES_V08, v08: { ...RULES_V08.v08, events: { ...RULES_V08.v08.events, enabled: 0 } } };
const withTradehouse = (patch: Partial<Rules['v08']['tradehouse']>): Rules => ({ ...base, v08: { ...base.v08, tradehouse: { ...base.v08.tradehouse, named: 0, buyoutFloor: 0, buyoutFixed: 0, ...patch } } });
const NAMED = withTradehouse({ named: 1 });
const FLOOR = withTradehouse({ buyoutFloor: 1 });
const FIXED = withTradehouse({ buyoutFixed: 60, buyoutChosen: 0 });
/** The official V0.8 rule (game-design.md §10): the owner names the crate, or none. */
const CHOSEN = withTradehouse({ buyoutFixed: 60, buyoutChosen: 1 });
const PREMIUM = withTradehouse({ premiumCrates: 1 });
const BUYOUT = withTradehouse({ buyoutPercent: 50 });

const ready = (rules: Rules): MatchState => {
  const start = plain(4, rules);
  return withDemand(start.players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), start), G(2, 2, 2, 1));
};
const owner = (rules: Rules) => edit(ready(rules), 'p1', { facility: 'tradehouse' });
const effects = (events: readonly MatchEvent[], effect: string) => find(events, 'v08-effect').filter((e) => e.effect === effect);

describe('V0.8 tradehouse presets', () => {
  it('buys the crate the owner names for a fixed 70 G, with no naming; V0.7.1 keeps every switch off', () => {
    expect(RULES_V08.v08.tradehouse).toMatchObject({ named: 0, premiumCrates: 0, buyoutPercent: 0, buyoutFloor: 0, buyoutFixed: 70, buyoutChosen: 1 });
    expect(RULES_V07.v08.tradehouse).toMatchObject({ named: 1, premiumCrates: 0, buyoutPercent: 0, buyoutFloor: 0, buyoutFixed: 0, buyoutChosen: 0 });
  });

  it('offers no good to name once the naming is off', () => {
    const invests = (state: MatchState) => getLegalActions(state, 'p1').filter((a): a is Extract<Action, { type: 'invest' }> => a.type === 'invest');
    expect(invests(owner(NAMED)).some((a) => a.protect !== undefined)).toBe(true);
    expect(invests(owner(PREMIUM)).some((a) => a.protect !== undefined)).toBe(false);
  });
});

describe('V0.8 tradehouse 老字號 (premiumCrates)', () => {
  it('sells the priciest arriving crate a cell higher, only for the owner', () => {
    const plan = { loads: { p1: G(1, 0, 0, 1) }, rolls: { p1: 6 } } as const;
    const premium = playRound(owner(PREMIUM), plan).events;
    const plainSale = cash(playRound(ready(PREMIUM), plan).events, 'sale', 'p1');
    const gained = cash(premium, 'sale', 'p1') - plainSale;
    // The arms crate (the priciest) sells one arms cell higher.
    expect(gained).toBeGreaterThan(0);
    expect(effects(premium, 'tradehouse-premium')).toMatchObject([{ playerId: 'p1', crates: 1, value: gained }]);
  });

  it('does nothing when the ship sinks', () => {
    const { events } = playRound(owner(PREMIUM), { loads: { p1: G(1, 0, 0, 1) }, rolls: { p1: 1 } });
    expect(effects(events, 'tradehouse-premium')).toHaveLength(0);
  });
});

describe('V0.8 tradehouse 收購剩貨 (buyoutPercent)', () => {
  it('buys the priciest warehouse crate at half its price at the end of the round', () => {
    const { state, events } = playRound(owner(BUYOUT), { loads: { p1: G(1) }, rolls: { p1: 6 } });
    const [bought] = effects(events, 'tradehouse-buyout');
    expect(bought).toMatchObject({ playerId: 'p1', crates: 1 });
    // Arms is the priciest good left (2 wood, 3 iron, 1 spice, 1 arms after loading).
    expect(bought!.value).toBe(Math.floor(priceAt(BUYOUT, 'arms', state.prices.arms) / 2));
    expect(cash(events, 'tradehouse-buyout', 'p1')).toBe(bought!.value);
    expect(cash(events, 'tradehouse-buyout', 'p2')).toBe(0);
  });

  it('acts every round, sailing or not, and only for the owner', () => {
    const { events } = playRound(owner(BUYOUT));
    expect(effects(events, 'tradehouse-buyout').map((e) => e.playerId)).toEqual(['p1']);
  });
});

describe('V0.8 tradehouse 收購剩貨 at the lowest cell (buyoutFloor)', () => {
  it('takes the crate it pays most for (arms, 95 G) and pays the lowest cell whatever the price', () => {
    const { events } = playRound(owner(FLOOR), { loads: { p1: G(1) }, rolls: { p1: 6 } });
    expect(effects(events, 'tradehouse-buyout')).toMatchObject([{ playerId: 'p1', crates: 1, value: priceAt(FLOOR, 'arms', 0) }]);
    expect(priceAt(FLOOR, 'arms', 0)).toBe(95);
  });

  it('pays 75 G for wood, iron or spice', () => {
    const noArms = edit(owner(FLOOR), 'p1', { stock: G(2, 0, 1, 0) });
    expect(effects(playRound(noArms).events, 'tradehouse-buyout')[0]!.value).toBe(75);
  });
});

describe('V0.8 tradehouse 收購剩貨 at a fixed price, picked by the tradehouse (buyoutFixed, buyoutChosen 0)', () => {
  it('takes the cheapest warehouse crate for the fixed price', () => {
    // 2 wood, 3 iron, 1 spice, 1 arms left: the cheapest is taken, whatever it is, for 60 G.
    const { state, events } = playRound(owner(FIXED), { loads: { p1: G(1) }, rolls: { p1: 6 } });
    const [bought] = find(events, 'leftover-bought');
    expect(bought).toMatchObject({ playerId: 'p1', value: 60 });
    const cheapest = Math.min(...(['wood', 'iron', 'spice', 'arms'] as const).map((g) => priceAt(FIXED, g, state.prices[g])));
    expect(priceAt(FIXED, bought!.good, state.prices[bought!.good])).toBe(cheapest);
    expect(cash(events, 'tradehouse-buyout', 'p1')).toBe(60);
  });
});

type Invest = Extract<Action, { type: 'invest' }>;
const invests = (state: MatchState, playerId = 'p1') => getLegalActions(state, playerId).filter((a): a is Invest => a.type === 'invest');

describe('V0.8 tradehouse 收購剩貨, the crate named by the owner (buyoutChosen, game-design.md §10)', () => {
  it('buys the named crate for 60 G at the end of the round', () => {
    const { state, events } = playRound(owner(CHOSEN), { loads: { p1: G(1) }, invest: { p1: { sell: 'iron' } } });
    expect(find(events, 'leftover-bought')).toEqual([expect.objectContaining({ playerId: 'p1', good: 'iron', value: 60 })]);
    expect(cash(events, 'tradehouse-buyout', 'p1')).toBe(60);
    const kept = playRound(owner(CHOSEN), { loads: { p1: G(1) } }).state;
    const stockOf = (st: MatchState) => st.players.find((p) => p.id === 'p1')!.stock;
    expect(stockOf(state)).toEqual({ ...stockOf(kept), iron: stockOf(kept).iron - 1 });
  });

  it('buys nothing when the owner names no crate, so a hoarder keeps every material', () => {
    const { events } = playRound(owner(CHOSEN), { loads: { p1: G(1) } });
    expect(find(events, 'leftover-bought')).toEqual([]);
    expect(cash(events, 'tradehouse-buyout', 'p1')).toBe(0);
  });

  it('can save a spice crate before it spoils', () => {
    const { events } = playRound(owner(CHOSEN), { invest: { p1: { sell: 'spice' } } });
    expect(find(events, 'leftover-bought')).toEqual([expect.objectContaining({ good: 'spice', value: 60 })]);
  });

  it('offers, for each load, no crate or one of every good still left in the warehouse', () => {
    const options = invests(owner(CHOSEN));
    const allWood = options.filter((a) => a.load.wood === 3 && a.load.iron === 0 && a.load.spice === 0 && a.load.arms === 0 && a.shipType === 'standard' && a.material === undefined);
    expect(allWood.map((a) => a.sell ?? null).sort()).toEqual(['arms', 'iron', 'spice', null].sort());
  });

  it('offers no crate to players without a tradehouse, and offers one when the tradehouse is built this round', () => {
    expect(invests(owner(CHOSEN), 'p2').some((a) => a.material?.kind !== 'build' && a.sell !== undefined)).toBe(false);
    const builder = edit(ready(CHOSEN), 'p2', { stock: G(3, 3, 1, 1) });
    const built = invests(builder, 'p2').filter((a) => a.material?.kind === 'build' && a.material.building === 'tradehouse');
    expect(built.some((a) => a.sell !== undefined)).toBe(true);
    expect(built.filter((a) => a.material !== undefined && a.sell === 'wood' && a.load.wood === 1)).toEqual([]);
  });

  it('rejects naming a crate that is loaded on the ship', () => {
    const state = edit(owner(CHOSEN), 'p1', { stock: G(1, 0, 0, 0) });
    expect(invests(state).some((a) => a.load.wood === 1 && a.sell === 'wood')).toBe(false);
  });
});
