import { describe, expect, it } from 'vitest';
import { RULES_V07, RULES_V08_PROTO, priceAt, type MatchEvent, type MatchState, type V08EventsState } from '../../../src/v07/game';
import { G, cash, edit, find, plain, playRound, withDemand } from './helpers';

// V0.8 simulation prototype, 海盜潮 without percents (v08.events.tidePirateArrivalCrates; playtest notes §10.14):
// pirates on an arriving ship take its priciest crate instead of 30 % of the income. NOT rules.

const V08 = RULES_V08_PROTO;
/** The armory with its 海盜潮 shield (the prototype dropped it 2026-11-22, §10.16). */
const SHIELDED: typeof V08 = { ...V08, v08: { ...V08.v08, armory: { ...V08.v08.armory, immunePirateTide: 1 } } };
const inPirateTide = (stock = G(3, 3, 1, 1), rules = V08): MatchState => {
  const base = withDemand(plain(4, rules), G(2, 2, 2, 1));
  const stocked = base.players.reduce((s, p) => edit(s, p.id, { stock }), base);
  const patch: Partial<V08EventsState> = { phaseTwoFrom: 1, tide: 'pirate' };
  return { ...stocked, v08Events: { ...stocked.v08Events!, ...patch } };
};
const effects = (events: readonly MatchEvent[], effect: string) => find(events, 'v08-effect').filter((e) => e.effect === effect);
const sail = (state: MatchState, load = G(2, 0, 0, 1), pirate = true) =>
  playRound(state, { loads: { p1: load }, rolls: { p1: 6 }, voyageEvent: 'calm-seas', ...(pirate ? { roles: { p2: ['pirate', 'p1'] as const } } : {}) });

describe('V0.8 pirate tide takes a crate', () => {
  it('is on in the prototype and off in the live rules', () => {
    expect(V08.v08.events.tidePirateArrivalCrates).toBe(1);
    expect(RULES_V07.v08.events.tidePirateArrivalCrates).toBe(0);
  });

  it('hands the priciest arriving crate to the pirate; the owner sells the rest', () => {
    // 1 wood and 2 arms; the pirate's −1 makes a 5, which loses the priciest crate (1 arms) at sea.
    const { state, events } = sail(inPirateTide(G(3, 3, 1, 2)), G(1, 0, 0, 2));
    expect(find(events, 'ship-resolved')[0]!.lost).toEqual(G(0, 0, 0, 1));
    const armsPrice = priceAt(V08, 'arms', state.prices.arms);
    expect(cash(events, 'pirate-loot', 'p2')).toBe(armsPrice);
    expect(effects(events, 'pirate-tide')).toMatchObject([{ playerId: 'p1', value: armsPrice }]);
    // Only the wood is sold.
    const unpirated = sail(inPirateTide(), G(1), false).events;
    expect(cash(events, 'sale', 'p1')).toBe(cash(unpirated, 'sale', 'p1'));
  });

  it('takes nothing without a pirate, and nothing from an armory owner (the tide shield)', () => {
    expect(effects(sail(inPirateTide(), G(2, 0, 0, 1), false).events, 'pirate-tide')).toHaveLength(0);
    // No arms aboard, so the armory does not fire back: the tide shield keeps the iron crate.
    const armory = edit(inPirateTide(undefined, SHIELDED), 'p1', { facility: 'armory' });
    const { state, events } = sail(armory, G(2, 1));
    expect(cash(events, 'pirate-loot', 'p2')).toBe(0);
    expect(effects(events, 'pirate-shield')).toMatchObject([{ playerId: 'p1', value: priceAt(V08, 'iron', state.prices.iron) }]);
  });
});
