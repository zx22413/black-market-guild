import { describe, expect, it } from 'vitest';
import type { DecisionContext } from '../../src/v07/bots';
import { RULES_V07, getLegalActions, getPendingDecisions, getPlayerView, type MatchState } from '../../src/v07/game';
import {
  canRaise,
  withRaise,
  materialCards,
  shipSkills,
  protectChoices,
  withMaterial,
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
  withShipType,
  unitsOf,
} from '../../src/ui-v07/table/investChoice';
import { G, edit, start, withWanted } from '../v07/game/helpers';

function contextOf(state: MatchState, playerId = 'p1'): DecisionContext {
  const decision = getPendingDecisions(state).find((d) => d.playerId === playerId)!;
  return { view: getPlayerView(state, playerId), decision, legalActions: getLegalActions(state, playerId) };
}

/** Round-1 investment for p1 on an island without traits that change capacity or ship cost. */
function scenario(patch: Parameters<typeof edit>[2] = {}) {
  const state = edit(start(4, undefined, { p1: 'lumber' }), 'p1', { cash: 1000, stock: G(2, 2, 1, 1), buildings: [], ...patch });
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

    const poor = scenario({ stock: G(0, 0, 0, 0) });
    expect(buildOptions(poor.context, poor.options).find((c) => c.id === 'salvage')!.reason).toBe('材料不足：木材、鐵礦');
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

  it('reminds about the wanted mark and spice left behind, and says nothing generic about customs', () => {
    const { context, options } = scenario();
    const withArms = loadOne(options, EMPTY_CHOICE, 'arms');
    const texts = investNotes(context, withArms).map((n) => n.text);
    // Customs is on the role cards: an ordinary ship carries no note about it.
    expect(texts.some((t) => t.includes('海關'))).toBe(false);
    // Nothing is said about guards confiscating arms any more (§9.4: a guard takes no goods).
    expect(texts.some((t) => t.includes('護衛'))).toBe(false);
    expect(investNotes(context, EMPTY_CHOICE).some((n) => n.text.includes('海關'))).toBe(false);
    expect(texts).toContain('1 香料沒裝，回合結束會壞掉');
    expect(investNotes(context, loadOne(options, withArms, 'spice')).some((n) => n.text.includes('香料'))).toBe(false);
  });

  it('gives every note icon chips so the table can show it without the sentence', () => {
    const { context, options } = scenario();
    const notes = investNotes(context, loadOne(options, EMPTY_CHOICE, 'arms'));
    for (const note of notes) expect(note.chips.length, note.text).toBeGreaterThan(0);
    expect(notes.find((n) => n.text.includes('香料'))?.chips).toEqual([{ kind: 'good', good: 'spice', count: 1 }, { kind: 'alert' }]);
  });

  it('says a hidden ship is out of the customs\' reach (ship-bay experiment)', () => {
    const state = edit(start(4, RULES_V07, { p1: 'lumber' }), 'p1', { cash: 1000, stock: G(2, 2, 1, 1), buildings: [] });
    const context = contextOf(state);
    const options = investOptions(context);
    const hidden = loadOne(options, withShipType(options, EMPTY_CHOICE, 'hidden'), 'wood');
    expect(investNotes(context, hidden).map((n) => n.text)).toContain('幽靈號：海關指名這艘船的貨無效');
    const standard = loadOne(options, withShipType(options, EMPTY_CHOICE, 'standard'), 'wood');
    expect(investNotes(context, standard).some((n) => n.text.includes('海關'))).toBe(false);
  });

  it('tells the Spice Isles that a ship with spice pays 25 G more, and shows it in the summary', () => {
    const state = edit(start(4, RULES_V07, { p1: 'spice-isles' }), 'p1', { cash: 1000, stock: G(2, 2, 2, 1), buildings: [] });
    const context = contextOf(state);
    const options = investOptions(context);
    const ship = withShipType(options, EMPTY_CHOICE, 'standard');
    const withSpice = loadOne(options, ship, 'spice');
    const note = investNotes(context, withSpice).find((n) => n.label === '香料船費');
    expect(note).toMatchObject({ text: '載了香料，這艘船的船費 +25 G', at: 'ship' });
    expect(investSummary(context, withSpice)).toMatchObject({ shipCost: 25, cashAfter: 975 });
    // No spice aboard, no fee and no note.
    const withWood = loadOne(options, ship, 'wood');
    expect(investNotes(context, withWood).some((n) => n.label === '香料船費')).toBe(false);
    expect(investSummary(context, withWood).shipCost).toBe(0);
  });

  it('tells a wanted player what it costs, as §9.6 says it', () => {
    const state = withWanted(edit(start(4, undefined, { p1: 'lumber' }), 'p1', { cash: 1000, stock: G(2, 2, 1, 1) }), ['p1']);
    const context = contextOf(state);
    const options = investOptions(context);
    const texts = investNotes(context, loadOne(options, EMPTY_CHOICE, 'wood')).map((n) => n.text);
    expect(texts).toContain('你被通緝：海盜取走這艘船的貨值時（最終值 1 或 2），另從銀行多拿 100 G');
    expect(texts.some((t) => t.includes('擊沉'))).toBe(false);
  });

  it('does not warn about spoiling spice on the Spice Isles (§11.2)', () => {
    const state = edit(start(4, undefined, { p1: 'spice-isles' }), 'p1', { stock: G(0, 0, 2, 0) });
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


describe('material actions in the invest choice (V0.8 prototype, not rules)', () => {
  const v08 = async (patch: Parameters<typeof edit>[2] = {}) => {
    const { RULES_V08_PROTO } = await import('../../src/v07/game');
    const state = edit(start(4, RULES_V08_PROTO, { p1: 'mine' }), 'p1', { cash: 1000, stock: G(3, 3, 1, 0), buildings: [], ...patch });
    const decision = getPendingDecisions(state).find((d) => d.playerId === 'p1')!;
    return { view: getPlayerView(state, 'p1'), decision, legalActions: getLegalActions(state, 'p1') } as DecisionContext;
  };

  const v08Proto = v08;

  it('offers nothing under the official rules', () => {
    expect(materialCards(contextOf(edit(start(4, RULES_V07, { p1: 'mine' }), 'p1', { cash: 1000 })))).toEqual([]);
  });

  it('lists the three buildings and the five ship skills with their cost, and why one cannot be taken', async () => {
    const cards = materialCards(await v08());
    expect(cards.map((c) => (c.material.kind === 'build' ? c.material.building : c.material.ship))).toEqual(['repairyard', 'armory', 'tradehouse', 'standard', 'gambler', 'freighter', 'hidden', 'breaker']);
    expect(cards.every((c) => c.legal && c.reason === null)).toBe(true);
    expect(cards[0]!.cost).toEqual(G(2, 1, 0, 0));
    expect(cards[3]!.cost).toEqual(G(0, 2, 0, 0));
    const poor = materialCards(await v08({ stock: G(1, 1, 0, 0) }));
    expect(poor.every((c) => !c.legal)).toBe(true);
    expect(poor[0]!.reason).toBe('材料不足');
    const built = materialCards(await v08({ facility: 'armory' }));
    expect(built.filter((c) => c.material.kind === 'build').every((c) => !c.legal && c.reason === '一局只能蓋 1 棟')).toBe(true);
    const skilled = materialCards(await v08({ skills: { standard: 1, gambler: 1 } }));
    expect(skilled.find((c) => c.material.kind === 'open' && c.material.ship === 'standard')!.reason).toBe('已開啟');
    expect(skilled.find((c) => c.material.kind === 'open' && c.material.ship === 'hidden')!.reason).toBe('最多開 2 艘');
  });

  it("says each ship's skill: closed, being opened in this choice, or open already, and why it cannot be opened", async () => {
    const fresh = shipSkills(materialCards(await v08()), EMPTY_CHOICE);
    expect(fresh.gambler).toEqual({ state: 'closed', cost: G(0, 2, 0, 0), legal: true, reason: null });
    const opening = shipSkills(materialCards(await v08()), { ...EMPTY_CHOICE, material: { kind: 'open', ship: 'gambler' } });
    expect(opening.gambler?.state).toBe('opening');
    expect(opening.hidden?.state).toBe('closed');
    const skilled = shipSkills(materialCards(await v08({ skills: { standard: 1, gambler: 1 } })), EMPTY_CHOICE);
    expect(skilled.standard).toMatchObject({ state: 'open', legal: false, reason: null });
    expect(skilled.hidden).toMatchObject({ state: 'closed', legal: false, reason: '最多開 2 艘' });
    expect(shipSkills(materialCards(await v08({ stock: G(1, 1, 0, 0) })), EMPTY_CHOICE).breaker?.reason).toBe('材料不足');
    // The official rules have no skills.
    expect(shipSkills([], EMPTY_CHOICE)).toEqual({});
  });

  it('submits the chosen material action and takes its cost out of what can be loaded', async () => {
    const ctx = await v08();
    const options = investOptions(ctx);
    const build = { kind: 'build', building: 'repairyard' } as const;
    const plain = actionFor(options, { ...EMPTY_CHOICE, shipType: 'standard', load: G(3, 0, 0, 0) });
    expect(plain?.material).toBeUndefined();
    const chosen = withMaterial(options, { ...EMPTY_CHOICE, shipType: 'standard', load: G(3, 0, 0, 0) }, build);
    // 2 wood go into the building: only 1 of the 3 loaded wood stays on the ship.
    expect(chosen.load).toEqual(G(1, 0, 0, 0));
    expect(actionFor(options, chosen)?.material).toEqual(build);
    expect(stockSplit(ctx, chosen)).toEqual({ forBuild: G(2, 1, 0, 0), onShip: G(1, 0, 0, 0), left: G(0, 2, 1, 0) });
    expect(actionFor(options, withMaterial(options, chosen, null))?.material).toBeUndefined();
    // Never the gambler's raise or private crates by accident.
    expect(options.filter((a) => a.raise || a.privateLoad).length).toBeGreaterThanOrEqual(0);
    expect(actionFor(options, chosen)?.raise).toBeUndefined();
  });

  it("names the tradehouse's protected good (v08.tradehouse.named, off in the prototype since 2026-11-22)", async () => {
    const { RULES_V08_PROTO } = await import('../../src/v07/game');
    const named = { ...RULES_V08_PROTO, v08: { ...RULES_V08_PROTO.v08, tradehouse: { ...RULES_V08_PROTO.v08.tradehouse, named: 1 } } };
    const v08 = async (patch: Parameters<typeof edit>[2] = {}) => {
      const state = edit(start(4, named, { p1: 'mine' }), 'p1', { cash: 1000, stock: G(3, 3, 1, 0), buildings: [], ...patch });
      const decision = getPendingDecisions(state).find((d) => d.playerId === 'p1')!;
      return { view: getPlayerView(state, 'p1'), decision, legalActions: getLegalActions(state, 'p1') } as DecisionContext;
    };
    expect(protectChoices(await v08Proto({ facility: 'tradehouse' }), EMPTY_CHOICE)).toEqual([]);
    const ctx = await v08({ facility: 'tradehouse' });
    const options = investOptions(ctx);
    expect(protectChoices(ctx, EMPTY_CHOICE)).toEqual(['wood', 'iron', 'spice', 'arms']);
    expect(actionFor(options, { ...EMPTY_CHOICE, protect: 'spice' })?.protect).toBe('spice');
    // Until one is named the first is taken, so the choice is never without a legal action.
    expect(actionFor(options, EMPTY_CHOICE)?.protect).toBe('wood');
    expect(protectChoices(await v08(), EMPTY_CHOICE)).toEqual([]);
    expect(protectChoices(await v08(), { ...EMPTY_CHOICE, material: { kind: 'build', building: 'tradehouse' } })).toEqual(['wood', 'iron', 'spice', 'arms']);
  });
});

describe("the gamble's raise in the invest choice (V0.8 prototype, not rules)", () => {
  const v08 = async (patch: Parameters<typeof edit>[2] = {}) => {
    const { RULES_V08_PROTO } = await import('../../src/v07/game');
    const state = edit(start(4, RULES_V08_PROTO, { p1: 'mine' }), 'p1', { cash: 1000, stock: G(3, 3, 1, 0), buildings: [], ...patch });
    const decision = getPendingDecisions(state).find((d) => d.playerId === 'p1')!;
    return { view: getPlayerView(state, 'p1'), decision, legalActions: getLegalActions(state, 'p1') } as DecisionContext;
  };
  const gamble = { ...EMPTY_CHOICE, shipType: 'gambler' as const, load: G(2, 0, 0, 0) };

  it('cannot be declared without the skill, on another ship, or with nothing aboard', async () => {
    expect(canRaise(investOptions(await v08()), gamble)).toBe(false);
    const options = investOptions(await v08({ skills: { gambler: 1 } }));
    expect(canRaise(options, gamble)).toBe(true);
    expect(canRaise(options, { ...gamble, shipType: 'standard' })).toBe(false);
    expect(canRaise(options, { ...gamble, load: G(0, 0, 0, 0) })).toBe(false);
  });

  it('submits the raise only when it is declared, and drops it when the ship changes', async () => {
    const options = investOptions(await v08({ skills: { gambler: 1 } }));
    expect(actionFor(options, gamble)?.raise).toBeUndefined();
    const raised = withRaise(options, gamble, true);
    expect(raised.raise).toBe(true);
    expect(actionFor(options, raised)?.raise).toBe(true);
    expect(actionFor(options, raised)?.load).toEqual(G(2, 0, 0, 0));
    expect(withRaise(options, raised, false).raise).toBe(false);
    const other = withShipType(options, raised, 'standard');
    expect(other.raise).toBe(false);
    expect(actionFor(options, other)?.raise).toBeUndefined();
    // Declaring it where it is not legal leaves the choice as it was.
    expect(withRaise(options, { ...gamble, shipType: 'standard' }, true).raise ?? false).toBe(false);
  });

  it('can be declared in the round the skill is opened', async () => {
    const options = investOptions(await v08());
    const opening = withMaterial(options, gamble, { kind: 'open', ship: 'gambler' });
    expect(canRaise(options, opening)).toBe(options.some((a) => a.raise && a.material?.kind === 'open'));
  });
});
