import { describe, expect, it } from 'vitest';
import {
  BOT_STRATEGIES,
  PERSONALITIES,
  createHeuristicBot,
  type Bot,
  type DecisionContext,
  type Personality,
} from '../../src/bots';
import {
  getLegalActions,
  getPendingDecisions,
  getPlayerView,
  RULES_V06,
  type MatchState,
} from '../../src/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/match';
import {
  atPhase,
  playUntil,
  scripted,
  startMatch,
  withAssets,
  withRawRolls,
  type Script,
} from '../game/helpers';

/** A deterministic variant that always takes the highest-scoring option. */
const greedy = (name: keyof typeof PERSONALITIES): Personality => ({ ...PERSONALITIES[name], temperature: 0 });

function contextFor(state: MatchState, playerId: string): DecisionContext {
  const decision = getPendingDecisions(state).find((d) => d.playerId === playerId);
  if (decision === undefined) {
    throw new Error(`${playerId} has no decision in ${state.phase}`);
  }
  return { view: getPlayerView(state, playerId), decision, legalActions: getLegalActions(state, playerId) };
}

function stateAt(phase: MatchState['phase'], script: Script, initial: MatchState = startMatch().state): MatchState {
  return playUntil(initial, atPhase(phase, 1), scripted(script)).state;
}

describe('heuristic bots in full matches', () => {
  const STRATEGIES = BOT_STRATEGIES.filter((s) => s !== 'random');

  it('offers several personalities', () => {
    expect(STRATEGIES).toEqual(['balanced', 'cautious', 'aggressive', 'opportunist']);
  });

  it.each(Array.from({ length: 30 }, (_, i) => i + 1))('seed %i: mixed strategies finish legally', (seed) => {
    const seats: SeatConfig[] = STRATEGIES.map((strategy) => ({ kind: 'bot', name: strategy, strategy }));
    const setup = setupFromSeats({ seed, seats, rules: RULES_V06 });
    const log = runMatchSync(setup, setup.bots);
    expect(log.finalState.phase).toBe('game-over');
  });

  it('is reproducible for the same seed', () => {
    const run = () => {
      const seats: SeatConfig[] = STRATEGIES.map((strategy) => ({ kind: 'bot', name: strategy, strategy }));
      const setup = setupFromSeats({ seed: 9, seats, rules: RULES_V06 });
      return runMatchSync(setup, setup.bots).actions;
    };
    expect(run()).toEqual(run());
  });
});

describe('heuristic decisions', () => {
  it('rerolls its own ship on a low raw roll and keeps a high one', () => {
    const script: Script = { solo: ['p1'], deploy: { p1: { role: 'intel', target: 'r1-s1' } } };
    const deploy = stateAt('role-deployment', script);
    const decide = (roll: number) => {
      const atReroll = playUntil(withRawRolls(deploy, { 'r1-s1': roll }), atPhase('intel-reroll', 1), scripted(script)).state;
      return createHeuristicBot(greedy('balanced'), 1).decide(contextFor(atReroll, 'p1'));
    };
    expect(decide(1)).toMatchObject({ type: 'intel-reroll', reroll: true });
    expect(decide(6)).toMatchObject({ type: 'intel-reroll', reroll: false });
  });

  it('prefers applying to a recruiter whose shipyard lowers its share', () => {
    const initial = withAssets(startMatch().state, 'p3', ['shipyard']);
    const state = stateAt('apply', { recruit: ['p1', 'p3'] }, initial);
    const action = createHeuristicBot(greedy('balanced'), 1).decide(contextFor(state, 'p2'));
    expect(action).toMatchObject({ type: 'apply', recruiterId: 'p3' });
  });

  it('avoids a recruiter who betrayed it before', () => {
    const state = stateAt('apply', { recruit: ['p1', 'p3'] });
    const bot: Bot = createHeuristicBot(greedy('balanced'), 1);
    bot.onEvents?.([
      { type: 'round-started', round: 0 },
      { type: 'ships-launched', round: 0, ships: [{ id: 'r0-s1', kind: 'joint', owners: ['p3', 'p2'], recruiters: ['p3'] }], stayedInPort: [] },
      {
        type: 'roles-revealed',
        round: 0,
        role: 'pirate',
        deployments: [{ playerId: 'p3', role: 'pirate', targetShipId: 'r0-s1' }],
        rerolledShipIds: [],
      },
    ]);
    const action = bot.decide(contextFor(state, 'p2'));
    expect(action).toMatchObject({ type: 'apply', recruiterId: 'p1' });
  });

  it('prefers an applicant who has not been seen smuggling', () => {
    const state = stateAt('pick', { recruit: ['p1'], apply: { p2: 'p1', p3: 'p1' } });
    const bot: Bot = createHeuristicBot(greedy('balanced'), 1);
    bot.onEvents?.([
      { type: 'round-started', round: 0 },
      { type: 'ships-launched', round: 0, ships: [{ id: 'r0-s1', kind: 'joint', owners: ['p4', 'p2'], recruiters: ['p4'] }], stayedInPort: [] },
      {
        type: 'roles-revealed',
        round: 0,
        role: 'smuggler',
        deployments: [{ playerId: 'p2', role: 'smuggler', targetShipId: 'r0-s1' }],
        rerolledShipIds: [],
      },
    ]);
    expect(bot.decide(contextFor(state, 'p1'))).toMatchObject({ type: 'pick', applicantId: 'p3' });
  });

  it('buys an asset early but not in the last round', () => {
    const bot = createHeuristicBot(greedy('balanced'), 1);
    const early = contextFor(startMatch().state, 'p1');
    expect(bot.decide(early)).toMatchObject({ type: 'buy-asset' });
    expect(bot.decide(early)).not.toMatchObject({ asset: null });
    const last = { ...early, view: { ...early.view, round: 6 } };
    expect(bot.decide(last)).toMatchObject({ type: 'buy-asset', asset: null });
  });

  it('always returns one of the legal actions', () => {
    const state = stateAt('role-deployment', { recruit: ['p1'], apply: { p2: 'p1' }, pick: { p1: 'p2' }, solo: ['p3', 'p4'] });
    for (const name of ['balanced', 'cautious', 'aggressive', 'opportunist'] as const) {
      const ctx = contextFor(state, 'p2');
      expect(ctx.legalActions).toContainEqual(createHeuristicBot(name, 3).decide(ctx));
    }
  });
});
