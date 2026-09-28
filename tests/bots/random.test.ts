import { describe, expect, it } from 'vitest';
import { createBot, createRandomBot, BOT_STRATEGIES, type DecisionContext } from '../../src/bots';
import { getLegalActions, getPendingDecisions, getPlayerView } from '../../src/game';
import { startMatch } from '../game/helpers';

function contextFor(playerId: string): DecisionContext {
  const { state } = startMatch();
  const decision = getPendingDecisions(state).find((d) => d.playerId === playerId)!;
  return { view: getPlayerView(state, playerId), decision, legalActions: getLegalActions(state, playerId) };
}

describe('random bot', () => {
  it('always picks one of the legal actions', () => {
    const bot = createRandomBot(1);
    const context = contextFor('p1');
    for (let i = 0; i < 50; i += 1) {
      expect(context.legalActions).toContainEqual(bot.decide(context));
    }
  });

  it('is reproducible from its seed', () => {
    const context = contextFor('p1');
    const picks = (seed: number) => {
      const bot = createRandomBot(seed);
      return Array.from({ length: 20 }, () => bot.decide(context));
    };
    expect(picks(3)).toEqual(picks(3));
  });

  it('throws when there is nothing legal to choose', () => {
    const context = { ...contextFor('p1'), legalActions: [] };
    expect(() => createRandomBot(1).decide(context)).toThrow();
  });
});

describe('bot registry', () => {
  it('creates bots by strategy name', () => {
    expect(BOT_STRATEGIES).toContain('random');
    const context = contextFor('p2');
    expect(context.legalActions).toContainEqual(createBot('random', 9).decide(context));
  });

  it('rejects unknown strategies', () => {
    expect(() => createBot('genius' as never, 1)).toThrow(/unknown bot strategy/);
  });
});
