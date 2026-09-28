import { describe, expect, it } from 'vitest';
import { createRandomBot, type DecisionContext } from '../../src/bots';
import { RULES_V06, type Action, type MatchEvent, type PrivateEvent } from '../../src/game';
import {
  botController,
  replayMatch,
  runMatch,
  runMatchSync,
  setupFromSeats,
  type Controller,
  type SeatConfig,
} from '../../src/match';

const FOUR_BOTS: SeatConfig[] = ['Alice', 'Bob', 'Carol', 'Dave'].map((name) => ({
  kind: 'bot',
  name,
  strategy: 'random',
}));

describe('setupFromSeats', () => {
  it('assigns ids p1..pN and deterministic bot controllers per seat', () => {
    const setup = setupFromSeats({ seed: 7, seats: FOUR_BOTS });
    expect(setup.players).toEqual([
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
      { id: 'p3', name: 'Carol' },
      { id: 'p4', name: 'Dave' },
    ]);
    expect(Object.keys(setup.bots)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('leaves human and remote seats for the caller to connect', () => {
    const seats: SeatConfig[] = [
      { kind: 'local-human', name: 'You' },
      ...FOUR_BOTS.slice(0, 2),
      { kind: 'remote', name: 'Friend' },
    ];
    const setup = setupFromSeats({ seed: 1, seats });
    expect(Object.keys(setup.bots)).toEqual(['p2', 'p3']);
    expect(setup.humanSeats).toEqual(['p1']);
    expect(setup.remoteSeats).toEqual(['p4']);
  });
});

describe('runMatchSync with random bots', () => {
  it('plays a full match and records every action', () => {
    const setup = setupFromSeats({ seed: 11, seats: FOUR_BOTS, rules: RULES_V06 });
    const log = runMatchSync(setup, setup.bots);
    expect(log.finalState.phase).toBe('game-over');
    expect(log.result.winners.length).toBeGreaterThan(0);
    expect(log.actions.length).toBeGreaterThan(0);
    expect(log.events.at(-1)).toEqual({ type: 'match-ended', result: log.result });
  });

  it('is deterministic for the same seed', () => {
    const run = () => {
      const setup = setupFromSeats({ seed: 5, seats: FOUR_BOTS, rules: RULES_V06 });
      return runMatchSync(setup, setup.bots);
    };
    expect(run()).toEqual(run());
  });

  it('produces the same log as the async runner driving the same bots', async () => {
    const syncSetup = setupFromSeats({ seed: 31, seats: FOUR_BOTS, rules: RULES_V06 });
    const asyncSetup = setupFromSeats({ seed: 31, seats: FOUR_BOTS, rules: RULES_V06 });
    const syncLog = runMatchSync(syncSetup, syncSetup.bots);
    const asyncControllers = Object.fromEntries(Object.entries(asyncSetup.bots).map(([id, bot]) => [id, botController(bot)]));
    const asyncLog = await runMatch(asyncSetup, asyncControllers);
    expect(asyncLog).toEqual(syncLog);
  });

  it('delivers frozen events so a controller cannot alter what other seats see', () => {
    const setup = setupFromSeats({ seed: 8, seats: FOUR_BOTS, rules: RULES_V06 });
    const attempts: string[] = [];
    const vandal = {
      decide: (ctx: DecisionContext) => setup.bots.p1!.decide(ctx),
      onEvents: (events: readonly MatchEvent[]) => {
        try {
          (events as MatchEvent[]).push({ type: 'round-ended', round: 99 });
        } catch {
          attempts.push('array');
        }
        try {
          (events[0] as { round?: number }).round = 99;
        } catch {
          attempts.push('event');
        }
      },
    };
    const log = runMatchSync(setup, { ...setup.bots, p1: vandal });
    expect(attempts.length).toBeGreaterThan(0);
    expect(log.events.some((e) => 'round' in e && e.round === 99)).toBe(false);
  });

  it('can be replayed from the seed and the action log alone', () => {
    const setup = setupFromSeats({ seed: 23, seats: FOUR_BOTS, rules: RULES_V06 });
    const log = runMatchSync(setup, setup.bots);
    const replayed = replayMatch(setup, log.actions);
    expect(replayed.finalState).toEqual(log.finalState);
    expect(replayed.events).toEqual(log.events);
    expect(replayed.privateEvents).toEqual(log.privateEvents);
  });

  it('rejects a controller that returns an illegal action', () => {
    const setup = setupFromSeats({ seed: 2, seats: FOUR_BOTS });
    const cheater = { decide: (ctx: DecisionContext): Action => ({ ...ctx.legalActions[0]!, playerId: 'p2' }) };
    expect(() => runMatchSync(setup, { ...setup.bots, p1: cheater })).toThrow(/p1/);
  });

  it('refuses to start with an invalid seat count', () => {
    const setup = setupFromSeats({ seed: 2, seats: FOUR_BOTS.slice(0, 2) });
    expect(() => runMatchSync(setup, setup.bots)).toThrow(/cannot start match: invalid-config/);
  });

  it('rejects a controller that returns an illegal action for its own seat', () => {
    const setup = setupFromSeats({ seed: 2, seats: FOUR_BOTS });
    const liar = { decide: (): Action => ({ type: 'buy-asset', playerId: 'p1', asset: 'nonexistent' as never }) };
    expect(() => runMatchSync(setup, { ...setup.bots, p1: liar })).toThrow(/p1 submitted an illegal action: illegal-action/);
  });

  it('rejects a missing controller', () => {
    const setup = setupFromSeats({ seed: 2, seats: FOUR_BOTS });
    const { p3: _dropped, ...partial } = setup.bots;
    expect(() => runMatchSync(setup, partial)).toThrow(/no controller for p3/);
  });
});

describe('runMatch (async controllers)', () => {
  it('asks every seat of a simultaneous phase at once instead of one after another', async () => {
    const setup = setupFromSeats({ seed: 6, seats: FOUR_BOTS, rules: RULES_V06 });
    let waiting = 0;
    let maxWaiting = 0;
    const controllers = Object.fromEntries(
      Object.entries(setup.bots).map(([id, bot]) => [
        id,
        {
          decide: async (ctx: DecisionContext) => {
            waiting += 1;
            maxWaiting = Math.max(maxWaiting, waiting);
            await new Promise((resolve) => setTimeout(resolve, 0));
            waiting -= 1;
            return bot.decide(ctx);
          },
        } satisfies Controller,
      ]),
    );
    await runMatch(setup, controllers);
    expect(maxWaiting).toBe(4);
  });


  it('drives a mix of bots and an async human-like controller', async () => {
    const setup = setupFromSeats({
      seed: 3,
      seats: [{ kind: 'local-human', name: 'You' }, ...FOUR_BOTS.slice(1)],
      rules: RULES_V06,
    });
    const human: Controller = {
      decide: async (ctx) => {
        await Promise.resolve();
        return ctx.legalActions[ctx.legalActions.length - 1]!;
      },
    };
    const controllers = { ...Object.fromEntries(Object.entries(setup.bots).map(([id, bot]) => [id, botController(bot)])), p1: human };
    const log = await runMatch(setup, controllers);
    expect(log.finalState.phase).toBe('game-over');
    expect(replayMatch(setup, log.actions).finalState).toEqual(log.finalState);
  });

  it('delivers public events to everyone and private events only to their owner', async () => {
    const setup = setupFromSeats({ seed: 4, seats: FOUR_BOTS, rules: RULES_V06 });
    const received: Record<string, { publicCount: number; private: PrivateEvent[] }> = {};
    const controllers = Object.fromEntries(
      setup.players.map(({ id }) => {
        received[id] = { publicCount: 0, private: [] };
        const bot = createRandomBot(100 + id.charCodeAt(1));
        const controller: Controller = {
          decide: async (ctx) => bot.decide(ctx),
          onEvents: (events: readonly MatchEvent[]) => {
            received[id]!.publicCount += events.length;
          },
          onPrivateEvent: (event: PrivateEvent) => {
            received[id]!.private.push(event);
          },
        };
        return [id, controller];
      }),
    );
    const log = await runMatch(setup, controllers);
    for (const { id } of setup.players) {
      expect(received[id]!.publicCount).toBe(log.events.length);
      expect(received[id]!.private.every((e) => e.playerId === id)).toBe(true);
    }
    const totalPrivate = Object.values(received).reduce((n, r) => n + r.private.length, 0);
    expect(totalPrivate).toBe(log.privateEvents.length);
  });
});
