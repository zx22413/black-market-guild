import { describe, expect, it } from 'vitest';
import type { DecisionContext } from '../../src/v07/bots';
import { getLegalActions, getPendingDecisions, getPlayerView, type MatchState } from '../../src/v07/game';
import {
  EMPTY_CHOICE,
  actionFor,
  buildOptions,
  canLoad,
  investNotes,
  investOptions,
  investSummary,
  investTodo,
  todoReminders,
  loadOne,
  stockSplit,
  submitLabel,
  unloadOne,
  unloadedBy,
  withBuild,
  unitsOf,
} from '../../src/ui-v07/table/investChoice';
import { G, edit, start } from '../v07/game/helpers';

function contextOf(state: MatchState, playerId = 'p1'): DecisionContext {
  const decision = getPendingDecisions(state).find((d) => d.playerId === playerId)!;
  return { view: getPlayerView(state, playerId), decision, legalActions: getLegalActions(state, playerId) };
}

/** Round-1 investment for p1 on an island without traits that change capacity or ship cost. */
function scenario(patch: Parameters<typeof edit>[2] = {}) {
  const state = edit(start(3, undefined, { p1: 'lumber' }), 'p1', { cash: 1000, stock: G(2, 2, 1, 1), buildings: [], ...patch });
  const context = contextOf(state);
  return { context, options: investOptions(context) };
}

describe('investment choice on the island (only legal actions)', () => {
  it('loads crates one by one up to the capacity, and every reachable choice is a legal action', () => {
    const { context, options } = scenario();
    let choice = EMPTY_CHOICE;
    for (const good of ['wood', 'iron', 'spice'] as const) choice = loadOne(options, choice, good);
    expect(investSummary(context, choice)).toMatchObject({ loaded: 3, capacity: 3, sails: true, shipCost: 100, cashAfter: 900 });
    expect(actionFor(options, choice)).toBeDefined();
    // §8: base capacity 3, so a fourth crate is refused.
    expect(canLoad(options, choice, 'arms')).toBe(false);
    expect(loadOne(options, choice, 'arms')).toBe(choice);
    expect(unloadOne(choice, 'wood').load.wood).toBe(0);
  });

  it('a shipyard uses 2 wood and raises the capacity at once (§8, §10.2)', () => {
    const { context, options } = scenario();
    const loaded = loadOne(options, loadOne(options, EMPTY_CHOICE, 'wood'), 'wood');
    // The two loaded wood are now needed for the shipyard, so the cargo is emptied.
    const built = withBuild(options, loaded, 'shipyard');
    expect(built.load).toEqual(G(0));
    expect(stockSplit(context, built).forBuild).toEqual(G(2));
    expect(canLoad(options, built, 'wood')).toBe(false);
    let choice = built;
    for (const good of ['iron', 'iron', 'spice', 'arms'] as const) choice = loadOne(options, choice, good);
    expect(investSummary(context, choice)).toMatchObject({ loaded: 4, capacity: 4, buildCash: 100, cashAfter: 800 });
    expect(actionFor(options, choice)).toBeDefined();
    expect(submitLabel(choice, investSummary(context, choice))).toBe('提交：蓋造船廠＋裝 4 件出航');
    expect(investNotes(context, choice).map((n) => n.text)).toEqual(expect.arrayContaining(['蓋造船廠會用掉 2 木材，不能再裝船', '造船廠當回合生效：可裝貨量 +1']));
  });

  it('keeps legal cargo when the building changes', () => {
    const { options } = scenario();
    const loaded = loadOne(options, EMPTY_CHOICE, 'spice');
    expect(withBuild(options, loaded, 'salvage').load.spice).toBe(1);
  });

  it('greys out buildings with the reason, and offers only what the legal actions offer', () => {
    const { context, options } = scenario({ buildings: ['shipyard', 'insurance'] });
    const cards = buildOptions(context, options);
    expect(cards.every((c) => !c.legal)).toBe(true);
    expect(cards.find((c) => c.id === 'shipyard')!.reason).toBe('已經有了');
    expect(cards.find((c) => c.id === 'salvage')!.reason).toBe('最多 2 棟');

    const poor = scenario({ stock: G(0, 1, 0, 0) });
    expect(buildOptions(poor.context, poor.options).find((c) => c.id === 'salvage')!.reason).toBe('材料不足：鐵礦');
    const broke = scenario({ cash: 50 });
    expect(buildOptions(broke.context, broke.options).find((c) => c.id === 'shipyard')!.reason).toBe('現金不足（100 G）');
    for (const card of buildOptions(broke.context, broke.options)) expect(card.legal).toBe(broke.options.some((a) => a.build === card.id));
  });

  it('greys out a building whose materials are already on the ship, and frees it when they come off', () => {
    const { context, options } = scenario();
    const loaded = loadOne(options, EMPTY_CHOICE, 'wood');
    const shipyard = (c: typeof loaded) => buildOptions(context, options, c.load).find((card) => card.id === 'shipyard')!;
    expect(shipyard(loaded)).toMatchObject({ legal: false, reason: '木材已裝船' });
    expect(shipyard(unloadOne(loaded, 'wood'))).toMatchObject({ legal: true, reason: null });
    // The card the player already chose stays selectable.
    const chosen = withBuild(options, EMPTY_CHOICE, 'shipyard');
    expect(shipyard(chosen).legal).toBe(true);
  });

  it('says so when the ship cost, not the materials, rules a building out after loading', () => {
    const { context, options } = scenario({ cash: 150 });
    const loaded = loadOne(options, EMPTY_CHOICE, 'spice');
    expect(buildOptions(context, options, loaded.load).find((c) => c.id === 'shipyard')).toMatchObject({ legal: false, reason: '現金不足（還要付出航成本）' });
  });

  it('reaches the same legal action whether the building or the cargo is chosen first', () => {
    const { options } = scenario();
    const buildFirst = loadOne(options, loadOne(options, withBuild(options, EMPTY_CHOICE, 'shipyard'), 'iron'), 'spice');
    const loadFirst = withBuild(options, loadOne(options, loadOne(options, EMPTY_CHOICE, 'iron'), 'spice'), 'shipyard');
    expect(loadFirst).toEqual(buildFirst);
    expect(actionFor(options, loadFirst)).toBeDefined();
  });

  it('takes only the crates that no longer fit off the ship when the shipyard is dropped', () => {
    const { options } = scenario();
    let choice = withBuild(options, EMPTY_CHOICE, 'shipyard');
    for (const good of ['iron', 'iron', 'spice', 'arms'] as const) choice = loadOne(options, choice, good);
    expect(unitsOf(choice.load)).toBe(4);
    const dropped = withBuild(options, choice, null);
    // §8: capacity falls back to 3, so exactly one crate comes off and the rest stays.
    expect(unitsOf(dropped.load)).toBe(3);
    expect(unitsOf(unloadedBy(choice.load, dropped.load))).toBe(1);
    expect(actionFor(options, dropped)).toBeDefined();
  });

  it('reminds about arms, the wanted mark and spice left behind', () => {
    const { context, options } = scenario();
    const withArms = loadOne(options, EMPTY_CHOICE, 'arms');
    const texts = investNotes(context, withArms).map((n) => n.text);
    expect(texts).toContain('軍火抵達時，若有別人的護衛守著會被沒收');
    expect(texts).toContain('1 香料沒裝，回合結束會壞掉');
    expect(investNotes(context, loadOne(options, withArms, 'spice')).some((n) => n.text.includes('香料'))).toBe(false);
  });

  it('gives every note icon chips so the table can show it without the sentence', () => {
    const { context, options } = scenario();
    const notes = investNotes(context, loadOne(options, EMPTY_CHOICE, 'arms'));
    for (const note of notes) expect(note.chips.length, note.text).toBeGreaterThan(0);
    expect(notes.find((n) => n.text.includes('軍火'))?.chips).toEqual([{ kind: 'good', good: 'arms' }, { kind: 'role', role: 'guard' }, { kind: 'alert' }]);
    expect(notes.find((n) => n.text.includes('香料'))?.chips).toEqual([{ kind: 'good', good: 'spice', count: 1 }, { kind: 'alert' }]);
  });

  it('does not warn about spoiling spice on the Spice Isles (§11.2)', () => {
    const state = edit(start(3, undefined, { p1: 'spice-isles' }), 'p1', { stock: G(0, 0, 2, 0) });
    expect(investNotes(contextOf(state), EMPTY_CHOICE).some((n) => n.text.includes('香料'))).toBe(false);
  });

  it('says plainly when nothing is chosen', () => {
    const { context } = scenario();
    expect(submitLabel(EMPTY_CHOICE, investSummary(context, EMPTY_CHOICE))).toBe('提交：不蓋也不出航');
  });

  it('marks the building and the cargo as unfinished until the player deals with them', () => {
    const { options } = scenario();
    expect(investTodo(options, EMPTY_CHOICE, false)).toEqual({ build: true, cargo: true });
    expect(todoReminders(investTodo(options, EMPTY_CHOICE, false))).toHaveLength(2);
    // Choosing "不蓋" counts as deciding the building.
    expect(investTodo(options, EMPTY_CHOICE, true).build).toBe(false);
    expect(investTodo(options, withBuild(options, EMPTY_CHOICE, 'salvage'), false).build).toBe(false);
    const loaded = loadOne(options, EMPTY_CHOICE, 'spice');
    expect(investTodo(options, loaded, true)).toEqual({ build: false, cargo: false });
    expect(todoReminders(investTodo(options, loaded, true))).toEqual([]);
  });

  it('does not nag about what cannot be done', () => {
    const { options } = scenario({ stock: G(0), buildings: ['shipyard', 'insurance'] });
    expect(investTodo(options, EMPTY_CHOICE, false)).toEqual({ build: false, cargo: false });
  });
});

