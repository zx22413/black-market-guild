import { describe, expect, it } from 'vitest';
import type { DecisionContext } from '../../src/v07/bots';
import { applyAction, getLegalActions, getPendingDecisions, getPlayerView, type Action, type MatchState } from '../../src/v07/game';
import {
  EMPTY_DEPLOY,
  betsFor,
  blockedReason,
  deployActionFor,
  deployLabel,
  deployOptions,
  deployTodo,
  peeksFor,
  pickRole,
  roleCards,
  targetsFor,
} from '../../src/ui-v07/table/deployChoice';
import { arrowPoint, revealArrows, revealGroups } from '../../src/ui-v07/table3d/revealModel';
import { G, edit, start } from '../v07/game/helpers';

function contextOf(state: MatchState, playerId = 'p1'): DecisionContext {
  const decision = getPendingDecisions(state).find((d) => d.playerId === playerId)!;
  return { view: getPlayerView(state, playerId), decision, legalActions: getLegalActions(state, playerId) };
}

function apply(state: MatchState, action: Action): MatchState {
  const r = applyAction(state, action);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.state;
}

/** Round 1 at role deployment: every player sails with one wood. */
function deploying(islands: Parameters<typeof start>[2] = {}): MatchState {
  let state = start(3, undefined, islands);
  for (const id of ['p1', 'p2', 'p3']) state = edit(state, id, { stock: G(1, 1, 1, 0) });
  for (const id of ['p1', 'p2', 'p3']) state = apply(state, { type: 'invest', playerId: id, build: null, load: G(1) });
  return state;
}

describe('role deployment choice (only legal actions)', () => {
  it('a role with a target needs a ship before it is a legal action', () => {
    const context = contextOf(deploying());
    const options = deployOptions(context);
    const pirate = pickRole('pirate');
    expect(deployTodo(pirate)).toEqual({ role: false, target: true, bet: false });
    expect(deployActionFor(options, pirate)).toBeUndefined();
    const target = targetsFor(options, 'pirate')[0]!;
    const chosen = { ...pirate, target };
    expect(deployActionFor(options, chosen)).toMatchObject({ role: 'pirate', targetShipId: target });
    expect(deployTodo(chosen)).toEqual({ role: false, target: false, bet: false });
  });

  it('nothing picked glows the hand; "不部署" is a real, legal choice', () => {
    const context = contextOf(deploying());
    const options = deployOptions(context);
    expect(deployTodo(EMPTY_DEPLOY).role).toBe(true);
    expect(deployActionFor(options, EMPTY_DEPLOY)).toBeUndefined();
    expect(deployActionFor(options, pickRole('none'))).toMatchObject({ role: null });
  });

  it('the broker bets on a good and a direction from the market (§9.4)', () => {
    const options = deployOptions(contextOf(deploying()));
    const broker = pickRole('broker');
    expect(deployTodo(broker).bet).toBe(true);
    const bet = betsFor(options)[0]!;
    // The bet also names a ship when one fits it (a bull bet: your own, a bear bet: an opponent's).
    const target = targetsFor(options, 'broker', bet)[0] ?? null;
    expect(deployActionFor(options, { ...broker, bet, target })).toMatchObject({ role: 'broker', bet, targetShipId: target });
    expect(betsFor(options)).toHaveLength(new Set(betsFor(options).map((b) => `${b.good}${b.direction}`)).size);
  });

  it('greys out a role on cooldown with the round it comes back (§9.3)', () => {
    const state = deploying();
    const me = state.players.find((p) => p.id === 'p1')!;
    const cooled = { ...state, players: state.players.map((p) => (p.id === 'p1' ? { ...me, lastUsed: { pirate: 1 } } : p)), round: 2 };
    const context = contextOf(cooled);
    const card = roleCards(context, deployOptions(context)).find((c) => c.id === 'pirate')!;
    expect(context.view.myAvailableRoles).not.toContain('pirate');
    expect(card.legal).toBe(false);
    expect(card.reason).toBe('冷卻中，第 4 回合可用');
  });

  it('the lighthouse intel merchant may look at a second ship, optionally (§11.2)', () => {
    const context = contextOf(deploying({ p1: 'lighthouse' }));
    const options = deployOptions(context);
    const target = targetsFor(options, 'intel')[0]!;
    const choice = { ...pickRole('intel'), target };
    const peeks = peeksFor(options, choice);
    expect(peeks.length).toBeGreaterThan(0);
    expect(peeks).not.toContain(target);
    expect(deployActionFor(options, choice)).toBeDefined();
    expect(deployActionFor(options, { ...choice, peek: peeks[0]! })).toMatchObject({ peekShipId: peeks[0] });
  });

  it('says why a ship cannot be picked for the role, and nothing for the ships that can be', () => {
    const context = contextOf(deploying());
    const options = deployOptions(context);
    const own = 'r1-p1';
    const other = 'r1-p2';
    // Guards and pirates may go anywhere: no reason anywhere.
    expect(blockedReason(context, options, pickRole('pirate'), own)).toBeNull();
    // A smuggler only boards its own ship to cover arms, and this one carries none.
    expect(blockedReason(context, options, pickRole('smuggler'), own)).toContain('沒有載軍火');
    expect(blockedReason(context, options, pickRole('smuggler'), other)).toBeNull();
    // A broker's bet decides which side's ship it may name (before a bet, any ship some bet could name is offered).
    expect(blockedReason(context, options, pickRole('broker'), own)).toBeNull();
    const bull = betsFor(options).find((b) => b.direction === 1)!;
    const bear = betsFor(options).find((b) => b.direction === -1)!;
    expect(blockedReason(context, options, { ...pickRole('broker'), bet: bull }, other)).toBe('押漲只能指定自己的船。');
    expect(blockedReason(context, options, { ...pickRole('broker'), bet: bear }, own)).toBe('押跌只能指定對手的船。');
    // No role, or "不部署": nothing to explain.
    expect(blockedReason(context, options, EMPTY_DEPLOY, own)).toBeNull();
    expect(blockedReason(context, options, pickRole('none'), own)).toBeNull();
  });

  it('tells the smuggler port why its own arms ship is off the list (§11.2)', () => {
    let state = start(3, undefined, { p1: 'smuggler-port' });
    for (const id of ['p1', 'p2', 'p3']) state = edit(state, id, { stock: G(1, 1, 1, 1) });
    state = apply(state, { type: 'invest', playerId: 'p1', build: null, load: G(0, 0, 0, 1) });
    for (const id of ['p2', 'p3']) state = apply(state, { type: 'invest', playerId: id, build: null, load: G(1) });
    const context = contextOf(state);
    expect(blockedReason(context, deployOptions(context), pickRole('smuggler'), 'r1-p1')).toContain('走私港的軍火不能被掩護');
  });

  it('the button says what is submitted', () => {
    const owner = () => 'p2';
    expect(deployLabel(EMPTY_DEPLOY, owner, (id) => id, 'p1')).toBe('提交：不部署');
    expect(deployLabel({ ...pickRole('pirate'), target: 's1' }, owner, () => '黑潮會', 'p1')).toBe('部署：海盜 → 黑潮會的船');
    expect(deployLabel(pickRole('guard'), owner, () => '黑潮會', 'p1')).toBe('先點護衛要去的船');
  });
});

describe('role reveal arrows', () => {
  it('one arrow per deployed role, from its player to its target, in reveal order; the extra look is faint', () => {
    let state = deploying({ p1: 'lighthouse' });
    const p1 = contextOf(state, 'p1');
    const target = targetsFor(deployOptions(p1), 'intel')[0]!;
    const peek = peeksFor(deployOptions(p1), { ...pickRole('intel'), target })[0]!;
    state = apply(state, deployActionFor(deployOptions(p1), { ...pickRole('intel'), target, peek })!);
    const p2 = contextOf(state, 'p2');
    const brokerBet = betsFor(deployOptions(p2))[0]!;
    state = apply(state, deployActionFor(deployOptions(p2), { ...pickRole('broker'), bet: brokerBet, target: targetsFor(deployOptions(p2), 'broker', brokerBet)[0] ?? null })!);
    const p3 = contextOf(state, 'p3');
    const result = applyAction(state, deployActionFor(deployOptions(p3), pickRole('none'))!);
    if (!result.ok) throw new Error(result.error.message);
    let events = [...result.value.events];
    let after = result.value.state;
    // p1's intel merchant decides on the reroll; then the roles are revealed.
    if (getPendingDecisions(after).length > 0) {
      const r = applyAction(after, getLegalActions(after, 'p1')[0]!);
      if (!r.ok) throw new Error(r.error.message);
      events = [...events, ...r.value.events];
      after = r.value.state;
    }
    const groups = revealGroups(events, 1);
    expect(groups.map((g) => g.role)).toEqual(['intel', 'broker']);

    const angles = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3];
    const lanes: Record<string, number> = { p1: 0, p2: 1, p3: 2 };
    const launched = state.roundState.ships;
    const owners = Object.fromEntries(launched.map((s) => [s.id, s.owner]));
    const intel = revealArrows(groups[0]!, angles, (id) => lanes[id]!, (id) => owners[id]);
    expect(intel.map((a) => a.faint)).toEqual([false, true]);
    expect(intel[0]!.label).toBe('情報商人');
    expect(intel[1]!.label).toBe('');
    const broker = revealArrows(groups[1]!, angles, (id) => lanes[id]!, (id) => owners[id]);
    expect(broker[0]!.label).toMatch(/^莊家 押/);
    expect(broker[0]!.to).toEqual([0, 9, 0]);
    // The curve starts on the player's island and ends on the target.
    expect(arrowPoint(intel[0]!, 0)).toEqual(intel[0]!.from);
    expect(arrowPoint(intel[0]!, 1).map((v) => Math.round(v * 1000) / 1000)).toEqual(intel[0]!.to.map((v) => Math.round(v * 1000) / 1000));
  });
});
