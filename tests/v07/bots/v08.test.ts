import { describe, expect, it } from 'vitest';
import { BOT_STRATEGIES, createBot, type BotStrategy } from '../../../src/v07/bots';
import { RULES_V08, getLegalActions, getPendingDecisions, getPlayerView } from '../../../src/v07/game';
import { runMatchSync, setupFromSeats } from '../../../src/v07/match';
import { G, apply, edit, plain, withDemand } from '../game/helpers';

/** V0.8 simulation prototype (RULES_V08): the bots must only ever take legal actions under its extra choices. */
describe('V0.8 prototype bots', () => {
  it('finish a few hundred mixed matches with only legal actions', { timeout: 120_000 }, () => {
    const strategies = BOT_STRATEGIES as readonly BotStrategy[];
    for (let seed = 1; seed <= 200; seed += 1) {
      const seats = Array.from({ length: 4 }, (_, k) => {
        const strategy = strategies[(seed + k * 2) % strategies.length]!;
        return { kind: 'bot' as const, name: `${strategy}#${k + 1}`, strategy };
      });
      const setup = setupFromSeats({ seed, seats, rules: RULES_V08 });
      // The runner throws on any illegal action.
      const log = runMatchSync(setup, setup.bots);
      expect(log.finalState.phase).toBe('game-over');
      // v08.events: the event deck ends the match between rounds 6 and 10.
      expect(log.finalState.round).toBeGreaterThanOrEqual(RULES_V08.v08.events.secondAdvanceFrom);
      expect(log.finalState.round).toBeLessThanOrEqual(RULES_V08.v08.events.maxRounds);
      log.finalState.players.forEach((p) => {
        expect(p.cash).toBeGreaterThanOrEqual(0);
        expect(Object.keys(p.skills ?? {}).length).toBeLessThanOrEqual(RULES_V08.v08.maxSkills);
      });
    }
  });

  it('take material actions, name a protected good and return one of the given actions', () => {
    // v08.tradehouse.named: the naming is off in the prototype since 2026-11-22, on here.
    const named = { ...RULES_V08, v08: { ...RULES_V08.v08, tradehouse: { ...RULES_V08.v08.tradehouse, named: 1 } } };
    let state = withDemand(edit(plain(4, named), 'p1', { stock: G(4, 4, 3, 3), facility: 'tradehouse' }), G(1, 1, 1, 1));
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

  it('leave the spice they keep to the tradehouse rather than let it spoil, and keep materials otherwise', () => {
    // v08.tradehouse.buyoutChosen: spice left in the warehouse is worth nothing next round, 60 G now.
    const state = withDemand(edit(plain(4, RULES_V08), 'p1', { stock: G(0, 0, 4, 0), facility: 'tradehouse' }), G(1, 1, 1, 1));
    const decide = (s: typeof state) => {
      const [decision] = getPendingDecisions(s);
      return createBot('balanced', 5).decide({ view: getPlayerView(s, 'p1'), decision: decision!, legalActions: getLegalActions(s, 'p1') });
    };
    const spiceAction = decide(state);
    expect(spiceAction.type === 'invest' && spiceAction.sell).toBe('spice');
  });
});
