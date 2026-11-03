import { describe, expect, it } from 'vitest';
import type { DecisionContext } from '../../src/v07/bots';
import { applyAction, getLegalActions, getPendingDecisions, getPlayerView, type Action, type MatchState } from '../../src/v07/game';
import {
  EMPTY_DEPLOY,
  blockedReason,
  deployActionFor,
  deployLabel,
  deployOptions,
  deployTodo,
  deploymentNote,
  goodsAtShip,
  guessesAtShip,
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
  let state = start(3, undefined, { p1: 'lumber', p2: 'lumber', p3: 'lumber', ...islands });
  for (const id of ['p1', 'p2', 'p3']) state = edit(state, id, { stock: G(1, 1, 1, 0) });
  for (const id of ['p1', 'p2', 'p3']) state = apply(state, { type: 'invest', playerId: id, build: null, load: G(1) });
  return state;
}

describe('role deployment choice (only legal actions)', () => {
  it('a role with a target needs a ship before it is a legal action', () => {
    const context = contextOf(deploying());
    const options = deployOptions(context);
    const pirate = pickRole('pirate');
    expect(deployTodo(pirate)).toEqual({ role: false, target: true, naming: false });
    expect(deployActionFor(options, pirate)).toBeUndefined();
    const target = targetsFor(options, 'pirate')[0]!;
    const chosen = { ...pirate, target };
    expect(deployActionFor(options, chosen)).toMatchObject({ role: 'pirate', targetShipId: target });
    expect(deployTodo(chosen)).toEqual({ role: false, target: false, naming: false });
  });

  it('nothing picked glows the hand; "不部署" is a real, legal choice', () => {
    const context = contextOf(deploying());
    const options = deployOptions(context);
    expect(deployTodo(EMPTY_DEPLOY).role).toBe(true);
    expect(deployActionFor(options, EMPTY_DEPLOY)).toBeUndefined();
    expect(deployActionFor(options, pickRole('none'))).toMatchObject({ role: null });
  });

  it('customs needs a ship and a good before it is a legal action (§9.4)', () => {
    const options = deployOptions(contextOf(deploying()));
    const customs = pickRole('customs');
    const target = targetsFor(options, 'customs')[0]!;
    expect(target).not.toBe('r1-p1');
    expect(deployTodo({ ...customs, target })).toEqual({ role: false, target: false, naming: true });
    expect(deployActionFor(options, { ...customs, target })).toBeUndefined();
    const good = goodsAtShip(options, target)[0]!;
    expect(goodsAtShip(options, target)).toHaveLength(4);
    expect(deployActionFor(options, { ...customs, target, good })).toMatchObject({ role: 'customs', targetShipId: target, namedGood: good });
  });

  it('a diplomat needs its own ship and a guess (§9.4)', () => {
    const options = deployOptions(contextOf(deploying()));
    const diplomat = pickRole('diplomat');
    expect(targetsFor(options, 'diplomat')).toEqual(['r1-p1']);
    expect(guessesAtShip(options, 'r1-p1').sort()).toEqual(['customs', 'guard', 'pirate', 'smuggler']);
    expect(deployActionFor(options, { ...diplomat, target: 'r1-p1' })).toBeUndefined();
    expect(deployActionFor(options, { ...diplomat, target: 'r1-p1', guess: 'pirate' })).toMatchObject({ role: 'diplomat', guessRole: 'pirate' });
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

  it('a smuggler may board any ship, its own to cover', () => {
    const options = deployOptions(contextOf(deploying()));
    expect(targetsFor(options, 'smuggler').sort()).toEqual(['r1-p1', 'r1-p2', 'r1-p3']);
  });

  it('says why a ship cannot be picked for the role, and nothing for the ships that can be', () => {
    const context = contextOf(deploying());
    const options = deployOptions(context);
    const own = 'r1-p1';
    const other = 'r1-p2';
    expect(blockedReason(context, options, pickRole('pirate'), own)).toBeNull();
    expect(blockedReason(context, options, pickRole('customs'), own)).toContain('只能上別人的船');
    expect(blockedReason(context, options, pickRole('customs'), other)).toBeNull();
    expect(blockedReason(context, options, pickRole('guard'), other)).toContain('只能守自己的船');
    expect(blockedReason(context, options, pickRole('diplomat'), other)).toContain('只能守自己的船');
    expect(blockedReason(context, options, EMPTY_DEPLOY, own)).toBeNull();
    expect(blockedReason(context, options, pickRole('none'), own)).toBeNull();
  });

  it('the button says what is submitted', () => {
    const owner = () => 'p2';
    expect(deployLabel(EMPTY_DEPLOY, owner, (id) => id, 'p1')).toBe('提交：不部署');
    expect(deployLabel({ ...pickRole('pirate'), target: 's1' }, owner, () => '黑潮會', 'p1')).toBe('部署：海盜 → 黑潮會的船');
    expect(deployLabel(pickRole('guard'), owner, () => '黑潮會', 'p1')).toBe('先點護衛要去的船');
    expect(deployLabel({ ...pickRole('customs'), target: 's1' }, owner, () => '黑潮會', 'p1')).toBe('再選要指名的貨');
    expect(deployLabel({ ...pickRole('customs'), target: 's1', good: 'arms' }, owner, () => '黑潮會', 'p1')).toBe('部署：海關 → 黑潮會的船，指名軍火');
    expect(deployLabel({ ...pickRole('diplomat'), target: 's1', guess: 'pirate' }, () => 'p1', () => '你', 'p1')).toBe('部署：外交官 → 猜海盜');
  });

  it('notes what customs named and a diplomat guessed', () => {
    expect(deploymentNote({ role: 'customs', namedGood: 'arms' })).toBe('指名軍火');
    expect(deploymentNote({ role: 'diplomat', guessRole: 'pirate' })).toBe('猜海盜');
    expect(deploymentNote({ role: 'pirate' })).toBeNull();
  });
});

describe('role reveal arrows', () => {
  it('one arrow per deployed role, from its player to its target, in reveal order', () => {
    let state = deploying();
    const p1 = contextOf(state, 'p1');
    const target = targetsFor(deployOptions(p1), 'customs')[0]!;
    state = apply(state, deployActionFor(deployOptions(p1), { ...pickRole('customs'), target, good: 'wood' })!);
    const p2 = contextOf(state, 'p2');
    state = apply(state, deployActionFor(deployOptions(p2), { ...pickRole('guard'), target: 'r1-p2' })!);
    const p3 = contextOf(state, 'p3');
    const result = applyAction(state, deployActionFor(deployOptions(p3), pickRole('none'))!);
    if (!result.ok) throw new Error(result.error.message);
    const events = [...result.value.events];
    const groups = revealGroups(events, 1);
    expect(groups.map((g) => g.role)).toEqual(['customs', 'guard']);

    const angles = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3];
    const lanes: Record<string, number> = { p1: 0, p2: 1, p3: 2 };
    const owners = Object.fromEntries(state.roundState.ships.map((s) => [s.id, s.owner]));
    const customs = revealArrows(groups[0]!, angles, (id) => lanes[id]!, (id) => owners[id]);
    expect(customs).toHaveLength(1);
    expect(customs[0]!.label).toBe('海關 指名木材');
    const guard = revealArrows(groups[1]!, angles, (id) => lanes[id]!, (id) => owners[id]);
    expect(guard[0]!.label).toBe('護衛');
    // The curve starts on the player's island and ends on the target.
    expect(arrowPoint(customs[0]!, 0)).toEqual(customs[0]!.from);
    expect(arrowPoint(customs[0]!, 1).map((v) => Math.round(v * 1000) / 1000)).toEqual(customs[0]!.to.map((v) => Math.round(v * 1000) / 1000));
  });
});
