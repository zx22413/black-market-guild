import { describe, expect, it } from 'vitest';
import { economyRules, runEconomyMatch, type EconomyMode } from '../../../src/proto/economy';
import { ECONOMY_BOT_STRATEGIES, createEconomyBot, type EconomyBotStrategy } from '../../../src/proto/economy/bots';

function seats(strategies: readonly EconomyBotStrategy[], seed: number) {
  return strategies.map((strategy, k) => ({ id: `p${k + 1}`, name: strategy, bot: createEconomyBot(strategy, seed * 10 + k) }));
}

describe.each(['A', 'B'] as const)('Option %s bot matches', (mode: EconomyMode) => {
  it('finish with legal actions, non-negative cash and conserved materials', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const players = seed % 2 === 0 ? 4 : 3;
      const lineup = Array.from({ length: players }, (_, k) => ECONOMY_BOT_STRATEGIES[(seed + k) % ECONOMY_BOT_STRATEGIES.length]!);
      const { state } = runEconomyMatch(seed, seats(lineup, seed), economyRules(mode));
      expect(state.phase).toBe('game-over');
      expect(state.history).toHaveLength(6);
      state.players.forEach((p) => {
        expect(p.cash).toBeGreaterThanOrEqual(0);
        expect(p.blackMoney).toBe(0);
        expect(p.stock.wood).toBeGreaterThanOrEqual(0);
        expect(p.stock.iron).toBeGreaterThanOrEqual(0);
      });
      state.history.forEach((r) => {
        expect(r.priceAfter.wood).toBeGreaterThanOrEqual(0);
        expect(r.priceAfter.wood).toBeLessThan(7);
      });
    }
  });

  it('is reproducible from the seed', () => {
    const lineup: EconomyBotStrategy[] = ['balanced', 'cautious', 'aggressive', 'builder'];
    const a = runEconomyMatch(5, seats(lineup, 5), economyRules(mode));
    const b = runEconomyMatch(5, seats(lineup, 5), economyRules(mode));
    expect(b.state).toEqual(a.state);
    expect(b.events).toEqual(a.events);
  });
});

describe('createEconomyBot', () => {
  it('rejects unknown strategies', () => {
    expect(() => createEconomyBot('nope' as EconomyBotStrategy, 1)).toThrow();
  });
});
