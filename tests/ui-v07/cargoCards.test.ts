import { describe, expect, it } from 'vitest';
import type { DecisionContext } from '../../src/v07/bots';
import { RULES_V07, getLegalActions, getPendingDecisions, getPlayerView, type IslandId } from '../../src/v07/game';
import { cargoCards } from '../../src/ui-v07/table/cargoCards';
import { EMPTY_CHOICE, investOptions, loadOne, withShipType } from '../../src/ui-v07/table/investChoice';
import { G, edit, start } from '../v07/game/helpers';

function scenario(island: IslandId, stock = G(2, 2, 1, 1), cash = 1000) {
  const state = edit(start(4, RULES_V07, { p1: island }), 'p1', { cash, stock, buildings: [] });
  const decision = getPendingDecisions(state).find((d) => d.playerId === 'p1')!;
  const context: DecisionContext = { view: getPlayerView(state, 'p1'), decision, legalActions: getLegalActions(state, 'p1') };
  return { context, options: investOptions(context) };
}

const card = (cards: ReturnType<typeof cargoCards>, good: string) => cards.find((c) => c.good === good)!;

describe('cargo cards (ship bays)', () => {
  it('has one card per good with the units left and aboard', () => {
    const { context, options } = scenario('mine');
    const ship = withShipType(options, EMPTY_CHOICE, 'standard');
    const loaded = loadOne(options, loadOne(options, ship, 'wood'), 'spice');
    const cards = cargoCards(context, options, loaded, 1, null);
    expect(cards.map((c) => c.good)).toEqual(['wood', 'iron', 'spice', 'arms']);
    expect(card(cards, 'wood')).toMatchObject({ left: 1, loaded: 1, loadable: true, reason: null });
    expect(card(cards, 'spice')).toMatchObject({ left: 0, loaded: 1, loadable: false, reason: '倉庫沒有了' });
    expect(card(cards, 'iron')).toMatchObject({ left: 2, loaded: 0, loadable: true });
  });

  it('greys every card once the ship is full, and says why', () => {
    const { context, options } = scenario('mine', G(3, 3, 3, 3));
    const full = ['wood', 'iron', 'arms'].reduce((c, g) => loadOne(options, c, g as 'wood'), withShipType(options, EMPTY_CHOICE, 'standard'));
    const cards = cargoCards(context, options, full, 1, null);
    expect(cards.every((c) => !c.loadable)).toBe(true);
    expect(card(cards, 'spice').reason).toBe('船裝滿了');
  });

  it('needs a ship before anything can be loaded', () => {
    const { context, options } = scenario('mine');
    const cards = cargoCards(context, options, EMPTY_CHOICE, 1, null);
    expect(cards.every((c) => !c.loadable)).toBe(true);
    expect(card(cards, 'wood').reason).toBe('先選一艘船');
  });

  it('warns about spice that would spoil, but not on the spice isles or when none is left', () => {
    const plain = scenario('mine');
    const ship = withShipType(plain.options, EMPTY_CHOICE, 'standard');
    expect(card(cargoCards(plain.context, plain.options, ship, 1, null), 'spice').spoils).toBe(true);
    expect(card(cargoCards(plain.context, plain.options, loadOne(plain.options, ship, 'spice'), 1, null), 'spice').spoils).toBe(false);
    const spice = scenario('spice-isles');
    expect(card(cargoCards(spice.context, spice.options, withShipType(spice.options, EMPTY_CHOICE, 'standard'), 1, null), 'spice').spoils).toBe(false);
  });

  it('shows a clock only for a good the island does not make next round', () => {
    // Every good is made every round except the mine\'s wood (rounds 1 and 4): after round 1 that is 3 rounds away.
    const { context, options } = scenario('mine');
    const cards = cargoCards(context, options, EMPTY_CHOICE, 1, null);
    expect(card(cards, 'wood').restock).toBe(3);
    expect(card(cards, 'iron').restock).toBeNull();
    expect(card(cards, 'spice').restock).toBeNull();
    // After the last production there is none to wait for.
    const late = cargoCards(context, options, EMPTY_CHOICE, 6, null);
    expect(card(late, 'iron').restock).toBe(0);
  });

  it('passes this round\'s production along for the arrival hint', () => {
    const { context, options } = scenario('mine');
    const cards = cargoCards(context, options, EMPTY_CHOICE, 1, G(1, 2, 0, 0));
    expect(card(cards, 'wood').made).toBe(1);
    expect(card(cards, 'iron').made).toBe(2);
    expect(card(cards, 'spice').made).toBe(0);
  });
});
