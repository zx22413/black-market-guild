import { describe, expect, it } from 'vitest';
import { createRandomBot, type Bot, type DecisionContext } from '../../../src/v07/bots';
import { RULES_V07, type MatchEvent } from '../../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../../src/v07/match';

const seats = (count: number): SeatConfig[] =>
  ['Alice', 'Bob', 'Carol', 'Dave'].slice(0, count).map((name) => ({ kind: 'bot', name, strategy: 'random' }));

/** Wraps a bot so every view it receives is checked for hidden-information leaks. */
function watchedBot(inner: Bot, violations: string[]): Bot {
  return {
    decide(ctx: DecisionContext) {
      const { view } = ctx;
      if (view.revealedRoles.length > 0) {
        violations.push(`round ${view.round}: roles visible before the reveal`);
      }
      if (JSON.stringify(view.ships).includes('Roll')) {
        violations.push(`round ${view.round}: dice visible in public ships`);
      }
      if (view.intel.length > 0 && view.myDeployment?.role !== 'intel') {
        violations.push(`round ${view.round}: intel knowledge without an intel deployment`);
      }
      if (view.ships.some((s) => s.owner !== view.playerId && s.outcome === null && s.cargo !== null)) {
        violations.push(`round ${view.round}: another player's cargo visible before resolution`);
      }
      if (view.mySubmission !== null && view.mySubmission.playerId !== view.playerId) {
        violations.push(`round ${view.round}: another player's submission visible`);
      }
      if (ctx.legalActions.some((a) => a.playerId !== view.playerId)) {
        violations.push(`round ${view.round}: legal actions for another player`);
      }
      return inner.decide(ctx);
    },
  };
}

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

describe.each([3, 4])('%i random bots over many seeds (V0.7 rules)', (count) => {
  it.each(SEEDS)('seed %i keeps every invariant', (seed) => {
    const setup = setupFromSeats({ seed, seats: seats(count), rules: RULES_V07 });
    const violations: string[] = [];
    const bots = Object.fromEntries(
      setup.players.map(({ id }, i) => [id, watchedBot(createRandomBot(seed * 10 + i), violations)]),
    );
    const log = runMatchSync(setup, bots);

    expect(violations).toEqual([]);
    expect(log.finalState.phase).toBe('game-over');
    expect(log.events.filter((e) => e.type === 'round-ended')).toHaveLength(6);

    const cash = new Map(setup.players.map(({ id }) => [id, RULES_V07.startingCash]));
    for (const event of log.events as MatchEvent[]) {
      if (event.type === 'cash-changed') {
        cash.set(event.playerId, cash.get(event.playerId)! + event.amount);
        expect(cash.get(event.playerId)).toBeGreaterThanOrEqual(0);
      }
      if (event.type === 'ships-launched') {
        const owners = event.ships.map((s) => s.owner);
        expect(new Set(owners).size).toBe(owners.length);
      }
    }
    for (const player of log.finalState.players) {
      expect(player.cash).toBe(cash.get(player.id));
      expect(new Set(player.buildings).size).toBe(player.buildings.length);
    }
    expect(JSON.stringify(log.events)).not.toMatch(/rawRoll|rerolledRoll/);
  });
});
