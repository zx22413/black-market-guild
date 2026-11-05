import { describe, expect, it } from 'vitest';
import type { DecisionContext } from '../../src/v07/bots';
import { RULES_V07, getLegalActions, getPendingDecisions, getPlayerView, type MatchState, type VoyageEventId } from '../../src/v07/game';
import {
  EMPTY_CHOICE,
  actionFor,
  canLoad,
  capacityWith,
  investOptions,
  investSummary,
  loadOne,
  unitsOf,
  withShipType,
} from '../../src/ui-v07/table/investChoice';
import { shipCards, shipEffect } from '../../src/ui-v07/table/shipChoice';
import { G, edit, start } from '../v07/game/helpers';

function contextOf(state: MatchState, playerId = 'p1'): DecisionContext {
  const decision = getPendingDecisions(state).find((d) => d.playerId === playerId)!;
  return { view: getPlayerView(state, playerId), decision, legalActions: getLegalActions(state, playerId) };
}

/** Round-1 investment of p1 under the ship-bay rules, on an island that changes neither fee nor capacity. */
function scenario(patch: Parameters<typeof edit>[2] = {}, event: VoyageEventId | null = null, island: 'mine' | 'lighthouse' = 'mine') {
  const base = edit(start(3, RULES_V07, { p1: island }), 'p1', { cash: 1000, stock: G(3, 3, 3, 3), buildings: [], ...patch });
  const state = { ...base, roundState: { ...base.roundState, voyageEvent: event } };
  return contextOf(state);
}

const card = (context: DecisionContext, id: string) => shipCards(context).find((c) => c.id === id)!;

describe('ship cards (ship-bay experiment)', () => {
  it('offers none while the experiment is off', () => {
    const state = edit(start(3, undefined, { p1: 'mine' }), 'p1', { cash: 1000 });
    expect(shipCards(contextOf(state))).toEqual([]);
  });

  it('lists the five types with their fee, rest time and the curve', () => {
    const context = scenario();
    expect(shipCards(context).map((c) => c.id)).toEqual(['standard', 'gambler', 'freighter', 'hidden', 'breaker']);
    const standard = card(context, 'standard');
    expect(standard.curve.map((r) => r.percent)).toEqual([0, 30, 45, 60, 75, 100]);
    expect(standard).toMatchObject({ fee: 0, cooldown: 0, sinkPercent: 17, legal: true, reason: null });
    expect(card(context, 'gambler')).toMatchObject({ fee: 150, cooldown: 1, sinkPercent: 67 });
    expect(card(context, 'freighter')).toMatchObject({ sinkPercent: 0, capacityBonus: 2, delay: 1 });
    expect(card(context, 'hidden').fee).toBe(40);
  });

  it("lists each ship's own curve by final value, with no modifier in it (a tailwind does not move it)", () => {
    for (const event of [null, 'tailwind', 'storm'] as const) {
      const context = scenario({}, event);
      expect(card(context, 'standard').curve.map((r) => r.percent)).toEqual([0, 30, 45, 60, 75, 100]);
      expect(card(context, 'standard').curve.map((r) => r.sinks)).toEqual([true, false, false, false, false, false]);
      // The gambler sinks at final value 4 and below whatever the wind does.
      expect(card(context, 'gambler').curve.map((r) => r.percent)).toEqual([0, 0, 0, 0, 125, 250]);
      expect(card(context, 'freighter').curve.map((r) => r.percent)).toEqual([25, 35, 45, 55, 65, 75]);
    }
  });

  it("shows the breaker's curve up to its top (final value 9, and nothing above it pays more) and says it is not capped", () => {
    const context = scenario();
    const breaker = card(context, 'breaker');
    expect(breaker.curve.map((r) => r.final)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(breaker.curve.map((r) => r.percent)).toEqual([0, 20, 35, 50, 70, 100, 175, 250, 300]);
    expect(breaker.curve.map((r) => r.orMore)).toEqual([false, false, false, false, false, false, false, false, true]);
    expect(breaker.cap).toBeNull();
    expect(card(context, 'standard').cap).toBe(6);
    expect(card(context, 'standard').curve.some((r) => r.orMore)).toBe(false);
  });

  it("is the ship's own data: no voyage event, island or wind changes the curve or the sinking chance", () => {
    const calm = scenario();
    for (const [context, why] of [
      [scenario({}, 'tailwind'), 'tailwind'],
      [scenario({}, 'storm'), 'storm'],
      [scenario({}, null, 'lighthouse'), 'a lighthouse island'],
    ] as const) {
      for (const id of ['standard', 'gambler', 'freighter', 'hidden', 'breaker']) {
        // (A lighthouse island adds to the fee, which is the island's own rule and not part of the curve.)
        expect(card(context, id).curve, `${id} under ${why}`).toEqual(card(calm, id).curve);
        expect(card(context, id).sinkPercent, `${id} under ${why}`).toBe(card(calm, id).sinkPercent);
      }
    }
  });

  it('counts the sinking chance over the die faces with the final value equal to the roll', () => {
    const context = scenario();
    // Final value 1 sinks the standard ship; 1 to 4 sink the gambler; the breaker's curve above 6 is not a die face.
    expect(card(context, 'standard').sinkPercent).toBe(17);
    expect(card(context, 'gambler').sinkPercent).toBe(67);
    expect(card(context, 'freighter').sinkPercent).toBe(0);
    expect(card(context, 'breaker').sinkPercent).toBe(17);
  });

  it('keeps what the public modifiers do apart from the ship: a tailwind lifts every roll by one', () => {
    const context = scenario({}, 'tailwind');
    expect(shipEffect(context)).toMatchObject({ total: 1, parts: [{ label: '順風', delta: 1 }], conditional: null });
    const standard = card(context, 'standard');
    // The curve and its own sinking chance stay; the rolls that land on each final value shift up (roll 6 stays at the cap).
    expect(standard.sinkPercent).toBe(17);
    expect(standard.effectRolls).toEqual([[], [1], [2], [3], [4], [5, 6]]);
    expect(standard.sinkPercentNow).toBe(0);
    // The gambler sinks on final values 1 to 4: rolls 1 to 3 with the wind.
    expect(card(context, 'gambler').sinkPercentNow).toBe(50);
    // The breaker is not capped: roll 6 reaches final value 7, and nothing reaches 8 or 9+.
    expect(card(context, 'breaker').effectRolls).toEqual([[], [1], [2], [3], [4], [5], [6], [], []]);
    expect(card(context, 'freighter').sinkPercentNow).toBe(0);
  });

  it('a storm lowers every roll by one, and the island adds its own', () => {
    const storm = scenario({}, 'storm');
    expect(shipEffect(storm)).toMatchObject({ total: -1, parts: [{ label: '暴風雨', delta: -1 }] });
    expect(card(storm, 'standard').effectRolls).toEqual([[1, 2], [3], [4], [5], [6], []]);
    expect(card(storm, 'standard').sinkPercentNow).toBe(33);

    const both = scenario({}, 'tailwind', 'lighthouse');
    expect(shipEffect(both).parts.map((p) => p.label)).toEqual(['順風', '燈塔島']);
    expect(shipEffect(both).total).toBe(2);
    // The plain card is the same under any of them.
    expect(card(both, 'standard').sinkPercent).toBe(17);
  });

  it('keeps the lighthouse island\'s limit apart from the ship: the final value stops at 5', () => {
    const lighthouse = scenario({}, null, 'lighthouse');
    expect(shipEffect(lighthouse)).toMatchObject({ total: 1, limit: '燈塔島：最終值最大 5' });
    expect(shipEffect(scenario({}, null, 'mine')).limit).toBeNull();
    // Each roll with the +1, held at 5: the plain ship never sinks and tops out at row 5.
    const standard = card(lighthouse, 'standard');
    expect(standard.effectRolls).toEqual([[], [1], [2], [3], [4], []].map((rolls, i) => (i === 4 ? [4, 5, 6] : rolls)));
    expect(standard.sinkPercentNow).toBe(0);
    // The curve is still the ship's own: the limit is not in it.
    expect(standard.curve.map((r) => r.percent)).toEqual([0, 30, 45, 60, 75, 100]);
    expect(card(lighthouse, 'breaker').effectRolls.slice(5)).toEqual([[], [], [], []]);
  });

  it('says only in a line that sea fog and a moonless night move the ships a role targets (nothing is added)', () => {
    for (const event of ['sea-fog', 'moonless-night'] as const) {
      const effect = shipEffect(scenario({}, event));
      expect(effect.total).toBe(0);
      expect(effect.conditional).toContain('鎖定');
    }
    expect(shipEffect(scenario({}, 'calm-seas')).conditional).toBeNull();
    expect(card(scenario({}, 'sea-fog'), 'standard').sinkPercentNow).toBe(17);
  });

  it('greys a type that is resting, too dear, or could not arrive before the end, and says why', () => {
    const resting = scenario();
    const later = { ...resting, view: { ...resting.view, round: 2, players: resting.view.players.map((p) => (p.id === 'p1' ? { ...p, lastShip: { gambler: 1 } } : p)) } };
    expect(card(later, 'gambler')).toMatchObject({ legal: false, reason: '休息中，第 3 回合可用' });
    expect(card(later, 'standard').legal).toBe(true);

    const poor = scenario({ cash: 100 });
    expect(card(poor, 'gambler')).toMatchObject({ legal: false, reason: '現金不足（船費 150 G）' });
    expect(card(poor, 'hidden').legal).toBe(true);

    const last = { ...resting, view: { ...resting.view, round: resting.view.totalRounds } };
    expect(card(last, 'freighter')).toMatchObject({ legal: false, reason: '最後一回合出發的船來不及抵達' });
    expect(card(last, 'standard').legal).toBe(true);
  });
});

describe('investment choice with a ship type (only legal actions)', () => {
  it('needs a ship type before any crate can be loaded, and a sailing action carries it', () => {
    const context = scenario();
    const options = investOptions(context);
    expect(canLoad(options, EMPTY_CHOICE, 'wood')).toBe(false);
    const picked = withShipType(options, EMPTY_CHOICE, 'standard');
    expect(canLoad(options, picked, 'wood')).toBe(true);
    const loaded = loadOne(options, picked, 'wood');
    expect(actionFor(options, loaded)).toMatchObject({ type: 'invest', load: G(1), shipType: 'standard' });
    // The same cargo on no ship is not an action; an empty ship needs no type.
    expect(actionFor(options, { ...loaded, shipType: null })).toBeUndefined();
    expect(actionFor(options, EMPTY_CHOICE)).toMatchObject({ load: G(0) });
  });

  it('adds the type\'s fee and extra capacity to the summary', () => {
    const context = scenario();
    expect(capacityWith(context, null, 'standard')).toBe(3);
    expect(capacityWith(context, null, 'freighter')).toBe(5);
    const gambler = { ...EMPTY_CHOICE, shipType: 'gambler' as const, load: G(1) };
    expect(investSummary(context, gambler)).toMatchObject({ shipCost: 150, cashAfter: 850, capacity: 3, sails: true });
  });

  it('takes the crates that no longer fit off the deck when a smaller ship is picked', () => {
    const context = scenario();
    const options = investOptions(context);
    let choice = withShipType(options, EMPTY_CHOICE, 'freighter');
    for (const good of ['wood', 'iron', 'spice', 'arms', 'arms'] as const) choice = loadOne(options, choice, good);
    expect(unitsOf(choice.load)).toBe(5);
    const smaller = withShipType(options, choice, 'standard');
    expect(smaller.shipType).toBe('standard');
    expect(unitsOf(smaller.load)).toBe(3);
    expect(actionFor(options, smaller)).toBeDefined();
    // Not sailing: the cargo goes with the ship.
    expect(unitsOf(withShipType(options, choice, null).load)).toBe(0);
  });
});
