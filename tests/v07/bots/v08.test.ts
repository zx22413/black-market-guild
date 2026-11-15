import { describe, expect, it } from 'vitest';
import { BOT_STRATEGIES, createBot, type BotStrategy } from '../../../src/v07/bots';
import { RULES_V08_PROTO, getLegalActions, getPendingDecisions, getPlayerView } from '../../../src/v07/game';
import { runMatchSync, setupFromSeats } from '../../../src/v07/match';
import { G, apply, edit, plain, withDemand } from '../game/helpers';

/** V0.8 simulation prototype (RULES_V08_PROTO): the bots must only ever take legal actions under its extra choices. */
describe('V0.8 prototype bots', () => {
  it('finish a few hundred mixed matches with only legal actions', { timeout: 120_000 }, () => {
    const strategies = BOT_STRATEGIES as readonly BotStrategy[];
    for (let seed = 1; seed <= 200; seed += 1) {
      const seats = Array.from({ length: 4 }, (_, k) => {
        const strategy = strategies[(seed + k * 2) % strategies.length]!;
        return { kind: 'bot' as const, name: `${strategy}#${k + 1}`, strategy };
      });
      const setup = setupFromSeats({ seed, seats, rules: RULES_V08_PROTO });
      // The runner throws on any illegal action.
      const log = runMatchSync(setup, setup.bots);
      expect(log.finalState.phase).toBe('game-over');
      // v08.events: the event deck ends the match between rounds 6 and 10.
      expect(log.finalState.round).toBeGreaterThanOrEqual(RULES_V08_PROTO.v08.events.secondAdvanceFrom);
      expect(log.finalState.round).toBeLessThanOrEqual(RULES_V08_PROTO.v08.events.maxRounds);
      log.finalState.players.forEach((p) => {
        expect(p.cash).toBeGreaterThanOrEqual(0);
        expect(Object.keys(p.skills ?? {}).length).toBeLessThanOrEqual(RULES_V08_PROTO.v08.maxSkills);
      });
    }
  });

  it('take material actions, name a protected good and return one of the given actions', () => {
    let state = withDemand(edit(plain(4, RULES_V08_PROTO), 'p1', { stock: G(4, 4, 3, 3), facility: 'tradehouse' }), G(1, 1, 1, 1));
    for (const strategy of ['balanced', 'cautious', 'aggressive', 'builder', 'random'] as const) {
      const bot = createBot(strategy, 5);
      const [decision] = getPendingDecisions(state);
      const legalActions = getLegalActions(state, decision!.playerId);
      const action = bot.decide({ view: getPlayerView(state, decision!.playerId), decision: decision!, legalActions });
      expect(legalActions).toContainEqual(action);
      if (strategy !== 'random' && action.type === 'invest') expect(action.protect).toBeDefined();
    }
    state = apply(state, getLegalActions(state, 'p1')[0]!).state;
    expect(state.roundState.submissions.p1).toBeDefined();
  });
});
