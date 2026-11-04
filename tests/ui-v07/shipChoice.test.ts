import { describe, expect, it } from 'vitest';
import type { DecisionContext } from '../../src/v07/bots';
import { RULES_SHIPS, getLegalActions, getPendingDecisions, getPlayerView, type MatchState, type VoyageEventId } from '../../src/v07/game';
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
import { knownModifier, shipCards } from '../../src/ui-v07/table/shipChoice';
import { G, edit, start } from '../v07/game/helpers';

function contextOf(state: MatchState, playerId = 'p1'): DecisionContext {
  const decision = getPendingDecisions(state).find((d) => d.playerId === playerId)!;
  return { view: getPlayerView(state, playerId), decision, legalActions: getLegalActions(state, playerId) };
}

/** Round-1 investment of p1 under the ship-bay rules, on an island that changes neither fee nor capacity. */
function scenario(patch: Parameters<typeof edit>[2] = {}, event: VoyageEventId | null = null, island: 'lumber' | 'lighthouse' = 'lumber') {
  const base = edit(start(3, RULES_SHIPS, { p1: island }), 'p1', { cash: 1000, stock: G(3, 3, 3, 3), buildings: [], ...patch });
  const state = { ...base, roundState: { ...base.roundState, voyageEvent: event } };
  return contextOf(state);
}

const card = (context: DecisionContext, id: string) => shipCards(context).find((c) => c.id === id)!;

describe('ship cards (ship-bay experiment)', () => {
  it('offers none while the experiment is off', () => {
    const state = edit(start(3, undefined, { p1: 'lumber' }), 'p1', { cash: 1000 });
    expect(shipCards(contextOf(state))).toEqual([]);
  });

  it('lists the five types with their fee, rest time and the die faces of the curve', () => {
    const context = scenario();
    expect(shipCards(context).map((c) => c.id)).toEqual(['standard', 'gambler', 'freighter', 'hidden', 'breaker']);
    const standard = card(context, 'standard');
    expect(standard.rows.map((r) => r.percent)).toEqual([0, 30, 45, 60, 75, 100]);
    expect(standard).toMatchObject({ fee: 0, cooldown: 0, sinkPercent: 17, legal: true, reason: null });
    expect(card(context, 'gambler')).toMatchObject({ fee: 150, cooldown: 1, sinkPercent: 67 });
    expect(card(context, 'freighter')).toMatchObject({ sinkPercent: 0, capacityBonus: 2, delay: 1 });
    expect(card(context, 'hidden').fee).toBe(40);
  });

  it('adds the public modifiers of the voyage event to the die faces (a storm sinks more, a tailwind lifts the breaker)', () => {
    const storm = scenario({}, 'storm');
    expect(knownModifier(storm)).toBe(-1);
    // Rolls 1 and 2 both end at final value 1 and sink.
    expect(card(storm, 'standard')).toMatchObject({ sinkPercent: 33 });
    expect(card(storm, 'standard').rows.map((r) => r.final)).toEqual([1, 1, 2, 3, 4, 5]);

    const tailwind = scenario({}, 'tailwind');
    expect(knownModifier(tailwind)).toBe(1);
    expect(card(tailwind, 'standard').rows.map((r) => r.final)).toEqual([2, 3, 4, 5, 6, 6]);
    // Only the breaker is not capped at the die's top face: roll 6 ends at final value 7.
    expect(card(tailwind, 'breaker').rows.map((r) => r.percent)).toEqual([20, 35, 50, 70, 100, 175]);
  });

  it('does not count the sea fog or the moonless night, which only move ships a role targets', () => {
    expect(knownModifier(scenario({}, 'sea-fog'))).toBe(0);
    expect(knownModifier(scenario({}, 'moonless-night'))).toBe(0);
  });

  it("adds the island's bonus for the player's own ship", () => {
    const context = scenario({}, null, 'lighthouse');
    expect(knownModifier(context)).toBe(1);
    expect(card(context, 'standard').rows.map((r) => r.final)).toEqual([2, 3, 4, 5, 6, 6]);
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
