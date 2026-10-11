import { describe, expect, it } from 'vitest';
import {
  BOT_STRATEGIES,
  PERSONALITIES,
  createBot,
  createHeuristicBot,
  createRandomBot,
  islandWorth,
  scoreAction,
  type BotStrategy,
} from '../../../src/v07/bots';
import { choose } from '../../../src/v07/bots/choose';
import { arriveChance } from '../../../src/v07/bots/estimates';
import { RULES_V07, createRng, getLegalActions, getPendingDecisions, getPlayerView, type Action } from '../../../src/v07/game';
import { G, apply, draft, edit, playRound, start } from '../game/helpers';
import { playBots } from './helpers';

const LINEUP: readonly BotStrategy[] = ['balanced', 'cautious', 'aggressive', 'builder'];

function lineupBots(players: number, seed: number) {
  return Array.from({ length: players }, (_, i) => createBot(LINEUP[(i + seed) % LINEUP.length]!, seed * 31 + i));
}

describe('V0.7 bots in full matches', () => {
  it.each([3, 4])('finish %i-player matches with only legal actions', (players) => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const { state, actions } = playBots(seed, lineupBots(players, seed));
      expect(state.phase).toBe('game-over');
      expect(state.result?.standings).toHaveLength(players);
      expect(actions.length).toBeGreaterThan(players * 6);
      state.players.forEach((p) => expect(p.cash).toBeGreaterThanOrEqual(0));
    }
  });

  it('only ever return one of the legal actions they were given', () => {
    const bots = [...LINEUP, 'random' as const].map((s, i) => createBot(s, i + 1));
    for (const bot of bots) {
      let state = start(4);
      for (let step = 0; step < 40 && state.phase !== 'game-over'; step += 1) {
        const [decision] = getPendingDecisions(state);
        const legalActions = getLegalActions(state, decision!.playerId);
        const action = bot.decide({ view: getPlayerView(state, decision!.playerId), decision: decision!, legalActions });
        expect(legalActions).toContainEqual(action);
        state = apply(state, action).state;
      }
    }
  });

  it('are reproducible from the seed', () => {
    const a = playBots(9, lineupBots(4, 9));
    const b = playBots(9, lineupBots(4, 9));
    expect(b.actions).toEqual(a.actions);
    expect(b.state).toEqual(a.state);
  });

  it('decide from a plain JSON copy of the view (no hidden state behind it)', () => {
    let state = start(3);
    const bot = createHeuristicBot('balanced', 3);
    const [decision] = getPendingDecisions(state);
    const view = JSON.parse(JSON.stringify(getPlayerView(state, decision!.playerId)));
    const action = bot.decide({ view, decision: decision!, legalActions: getLegalActions(state, decision!.playerId) });
    state = apply(state, action).state;
    expect(state.roundState.submissions[decision!.playerId]).toEqual(action);
  });

  it('random bots also finish matches', () => {
    const { state } = playBots(4, [createRandomBot(1), createRandomBot(2), createRandomBot(3)]);
    expect(state.phase).toBe('game-over');
  });
});

describe('V0.7 bot factory and helpers', () => {
  it('lists every strategy and rejects unknown ones', () => {
    expect(BOT_STRATEGIES).toEqual(['random', 'balanced', 'cautious', 'aggressive', 'builder']);
    expect(() => createBot('nope' as BotStrategy, 1)).toThrow(/unknown bot strategy/);
  });

  it('throw when there is nothing to choose', () => {
    const state = start(3);
    const decision = { playerId: 'p1', phase: 'invest' as const };
    const context = { view: getPlayerView(state, 'p1'), decision, legalActions: [] };
    expect(() => createRandomBot(1).decide(context)).toThrow(/no legal action/);
    expect(() => createHeuristicBot('balanced', 1).decide(context)).toThrow(/no legal action/);
    expect(() => choose([], [], 10, createRng(1))).toThrow(/no options/);
  });

  it('choose picks the best option at temperature 0 and samples otherwise', () => {
    const options: Action[] = [null, 'r1-p1'].map((rerollShipId) => ({ type: 'intel-reroll', playerId: 'p1', rerollShipId }));
    expect(choose(options, [0, 5], 0, createRng(1))).toBe(options[1]);
    const picks = new Set(Array.from({ length: 50 }, (_, i) => choose(options, [0, 1], 100, createRng(i))));
    expect(picks.size).toBe(2);
  });

  it('accepts a custom personality', () => {
    const { state } = playBots(2, [createHeuristicBot({ ...PERSONALITIES.balanced, temperature: 0 }, 1), createBot('cautious', 2), createBot('builder', 3)]);
    expect(state.phase).toBe('game-over');
  });

  it('arrival chance follows §9.1 (4-6 arrives, clamped to 1-6)', () => {
    expect(arriveChance(RULES_V07, 0)).toBe(0.5);
    expect(arriveChance(RULES_V07, 1)).toBeCloseTo(4 / 6);
    expect(arriveChance(RULES_V07, -3)).toBe(0);
    expect(arriveChance(RULES_V07, 5)).toBe(1);
  });
});

describe('V0.7 bot decisions', () => {
  it('drafts one of its own offered islands', () => {
    const { state } = draft(4);
    const bot = createHeuristicBot('balanced', 1);
    const decision = { playerId: 'p2', phase: 'island-choice' as const };
    const action = bot.decide({ view: getPlayerView(state, 'p2'), decision, legalActions: getLegalActions(state, 'p2') });
    expect(action.type === 'choose-island' && state.islandOffers.p2!.includes(action.island)).toBe(true);
  });

  it('values islands from their traits and its personality', () => {
    const view = getPlayerView(draft(4).state, 'p1');
    const worth = (name: keyof typeof PERSONALITIES, island: Parameters<typeof islandWorth>[1]) => islandWorth(view, island, PERSONALITIES[name]);
    expect(worth('cautious', 'lighthouse')).toBeGreaterThan(worth('aggressive', 'lighthouse'));
    expect(worth('aggressive', 'pirate-cove')).toBeGreaterThan(worth('cautious', 'pirate-cove'));
    expect(worth('builder', 'lumber')).toBeGreaterThan(worth('balanced', 'lumber'));
    expect(worth('cautious', 'fortress')).toBeGreaterThan(worth('aggressive', 'fortress'));
    expect(worth('balanced', 'spice-isles')).toBeGreaterThan(0);
    expect(worth('balanced', 'smuggler-port')).toBeLessThan(worth('balanced', 'free-port'));
  });

  it('ships spice rather than letting it spoil', () => {
    const state = edit(start(3), 'p1', { island: null, stock: G(1, 0, 1) });
    const view = getPlayerView(state, 'p1');
    const persona = PERSONALITIES.balanced;
    const ship: Action = { type: 'invest', playerId: 'p1', build: null, load: G(1, 0, 1) };
    const stay: Action = { type: 'invest', playerId: 'p1', build: null, load: G(1) };
    expect(scoreAction(view, ship, persona)).toBeGreaterThan(scoreAction(view, stay, persona));
  });

  it('only bets as a broker when nobody sails', () => {
    let state = start(3);
    for (const p of state.players) {
      state = apply(state, { type: 'invest', playerId: p.id, build: null, load: G(0) }).state;
    }
    expect(state.phase).toBe('role-deployment');
    const legalActions = getLegalActions(state, 'p1');
    const action = createHeuristicBot('balanced', 5).decide({ view: getPlayerView(state, 'p1'), decision: { playerId: 'p1', phase: 'role-deployment' }, legalActions });
    expect(action.type === 'deploy-role' && (action.role === null || action.role === 'broker')).toBe(true);
  });

  it('values guards, pirates, smugglers and intel by ship and island', () => {
    let state = start(3, undefined, { p1: 'mine', p2: 'mine', p3: 'smuggler-port' });
    state = edit(edit(state, 'p3', { stock: G(0, 0, 0, 2) }), 'p1', { stock: G(1, 2) });
    for (const [id, load] of [['p1', G(1, 2)], ['p2', G(1)], ['p3', G(0, 0, 0, 2)]] as const) {
      state = apply(state, { type: 'invest', playerId: id, build: null, load }).state;
    }
    const persona = PERSONALITIES.balanced;
    const deploy = (playerId: string, role: 'guard' | 'pirate' | 'smuggler' | 'intel', owner: string): Action => ({
      type: 'deploy-role',
      playerId,
      role,
      targetShipId: `r1-${owner}`,
      bet: null,
      peekShipId: null,
    });
    const p1 = getPlayerView(state, 'p1');
    const p3 = getPlayerView(state, 'p3');
    // Guarding my own full load is worth the fee.
    expect(scoreAction(p1, deploy('p1', 'guard', 'p1'), persona)).toBeGreaterThan(0);
    // Attacking my own ship is worse than attacking a rival's.
    expect(scoreAction(p1, deploy('p1', 'pirate', 'p2'), persona)).toBeGreaterThan(scoreAction(p1, deploy('p1', 'pirate', 'p1'), persona));
    expect(scoreAction(p1, deploy('p1', 'smuggler', 'p2'), persona)).toBeGreaterThan(0);
    expect(scoreAction(p1, deploy('p1', 'intel', 'p1'), persona)).toBeGreaterThan(scoreAction(p1, deploy('p1', 'intel', 'p2'), persona));
    // Smuggler Port's arms cannot be covered (§11.2), so covering them is worthless.
    expect(scoreAction(p3, deploy('p3', 'smuggler', 'p3'), persona)).toBeCloseTo(0);
    expect(scoreAction(p3, { type: 'deploy-role', playerId: 'p3', role: null, targetShipId: null, bet: null, peekShipId: null }, persona)).toBe(0);
  });

  it('covers its own arms with a smuggler where cover works', () => {
    let state = start(3, undefined, { p1: 'mine', p2: 'mine', p3: 'mine' });
    state = edit(state, 'p1', { stock: G(0, 0, 0, 2) });
    for (const [id, load] of [['p1', G(0, 0, 0, 2)], ['p2', G(1)], ['p3', G(0)]] as const) {
      state = apply(state, { type: 'invest', playerId: id, build: null, load }).state;
    }
    const cover: Action = { type: 'deploy-role', playerId: 'p1', role: 'smuggler', targetShipId: 'r1-p1', bet: null, peekShipId: null };
    expect(scoreAction(getPlayerView(state, 'p1'), cover, PERSONALITIES.balanced)).toBeGreaterThan(0);
  });

  it('rerolls a looked-at ship carrying its cargo only when the roll would sink it', () => {
    const rerollChoice = (roll: number) => {
      let state = start(3, undefined, { p1: 'mine', p2: 'mine', p3: 'mine' });
      for (const [id, load] of [['p1', G(1)], ['p2', G(1)], ['p3', G(0)]] as const) {
        state = apply(state, { type: 'invest', playerId: id, build: null, load }).state;
      }
      state = { ...state, roundState: { ...state.roundState, ships: state.roundState.ships.map((s) => ({ ...s, rawRoll: roll })) } };
      state = apply(state, { type: 'deploy-role', playerId: 'p1', role: 'intel', targetShipId: 'r1-p1', bet: null, peekShipId: null }).state;
      for (const id of ['p2', 'p3']) {
        state = apply(state, { type: 'deploy-role', playerId: id, role: null, targetShipId: null, bet: null, peekShipId: null }).state;
      }
      expect(state.phase).toBe('intel-reroll');
      const action = createHeuristicBot('balanced', 1).decide({
        view: getPlayerView(state, 'p1'),
        decision: { playerId: 'p1', phase: 'intel-reroll' },
        legalActions: getLegalActions(state, 'p1'),
      });
      return action.type === 'intel-reroll' ? action.rerollShipId : 'other';
    };
    expect(rerollChoice(2)).toBe('r1-p1');
    expect(rerollChoice(5)).toBeNull();
  });

  it('plays a scripted round without errors from the helpers', () => {
    expect(playRound(start(3)).state.round).toBe(2);
  });
});
