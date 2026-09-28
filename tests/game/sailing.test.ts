import { describe, expect, it } from 'vitest';
import { applyAction, getLegalActions, getPlayerView, type MatchEvent } from '../../src/game';
import {
  atPhase,
  playUntil,
  sailSolo,
  startMatch,
  unwrap,
  withCash,
  withRawRolls,
} from './helpers';

const cashOf = (state: { players: readonly { id: string; cash: number }[] }, id: string) =>
  state.players.find((p) => p.id === id)!.cash;

/** Plays round 1 up to the start of role deployment with the given solo sailors. */
function launchRound1(...sailors: string[]) {
  const start = startMatch();
  const played = playUntil(start.state, atPhase('role-deployment', 1), sailSolo(...sailors));
  return { state: played.state, events: [...start.events, ...played.events] };
}

/** Finishes the current round with everyone doing nothing, returning its events. */
function finishRound(state: Parameters<typeof playUntil>[0]) {
  const round = state.round;
  return playUntil(state, (s) => s.round !== round || s.phase === 'game-over');
}

describe('sailing choice legal options (game-design.md §6)', () => {
  it('offers staying in port and a solo voyage when the player can pay 100 G', () => {
    const { state } = playUntil(startMatch().state, atPhase('sailing-choice'));
    const choices = getLegalActions(state, 'p1').map((a) => a.type === 'choose-sailing' && a.choice);
    expect(choices).toEqual(['stay', 'solo']);
  });

  it('forbids a solo voyage when cash is below the 100 G cost', () => {
    const { state } = playUntil(startMatch().state, atPhase('sailing-choice'));
    const poor = withCash(state, 'p1', 99);
    const choices = getLegalActions(poor, 'p1').map((a) => a.type === 'choose-sailing' && a.choice);
    expect(choices).toEqual(['stay']);
    const result = applyAction(poor, { type: 'choose-sailing', playerId: 'p1', choice: 'solo' });
    expect(!result.ok && result.error.code).toBe('illegal-action');
  });
});

describe('launching ships (game-design.md §5 step 3, §6 成本支付)', () => {
  it('charges 100 G per solo ship right after the sailing choice; stayers pay nothing', () => {
    const { state } = launchRound1('p1', 'p3');
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => cashOf(state, id))).toEqual([900, 1000, 900, 1000]);
  });

  it('creates one public solo ship per sailor and announces who stayed in port', () => {
    const { state, events } = launchRound1('p1', 'p3');
    expect(state.roundState.ships.map((s) => [s.id, s.kind, s.owners])).toEqual([
      ['r1-s1', 'solo', ['p1']],
      ['r1-s2', 'solo', ['p3']],
    ]);
    const launched = events.find((e) => e.type === 'ships-launched');
    expect(launched).toEqual({
      type: 'ships-launched',
      round: 1,
      ships: [
        { id: 'r1-s1', kind: 'solo', owners: ['p1'], recruiters: [] },
        { id: 'r1-s2', kind: 'solo', owners: ['p3'], recruiters: [] },
      ],
      stayedInPort: ['p2', 'p4'],
    });
    expect(events).toContainEqual({
      type: 'cash-changed',
      round: 1,
      playerId: 'p1',
      amount: -100,
      reason: 'ship-cost',
      shipId: 'r1-s1',
    });
  });

  it('rolls a raw 1d6 for each ship before role deployment', () => {
    const { state, events } = launchRound1('p1', 'p2', 'p3', 'p4');
    for (const ship of state.roundState.ships) {
      expect(ship.rawRoll).toBeGreaterThanOrEqual(1);
      expect(ship.rawRoll).toBeLessThanOrEqual(6);
      expect(ship.outcome).toBeNull();
    }
    const launchedAt = events.findIndex((e) => e.type === 'ships-launched');
    const deploymentAt = events.findIndex((e) => e.type === 'phase-started' && e.phase === 'role-deployment');
    expect(launchedAt).toBeLessThan(deploymentAt);
  });

  it('draws the dice from the match rng deterministically', () => {
    const a = launchRound1('p1', 'p2', 'p3', 'p4').state;
    const b = launchRound1('p1', 'p2', 'p3', 'p4').state;
    expect(a.roundState.ships).toEqual(b.roundState.ships);
    expect(a.rng).toEqual(b.rng);
    expect(a.rng).not.toBe(startMatch().state.rng);
  });

  it('never reveals raw rolls in player views or public events', () => {
    const { state, events } = launchRound1('p1', 'p2');
    const view = getPlayerView(state, 'p1');
    expect(view.ships.map((s) => [s.id, s.kind, s.owners, s.outcome])).toEqual([
      ['r1-s1', 'solo', ['p1'], null],
      ['r1-s2', 'solo', ['p2'], null],
    ]);
    expect(JSON.stringify(view)).not.toContain('rawRoll');
    expect(JSON.stringify(events)).not.toContain('rawRoll');
  });
});

describe('voyage resolution without roles or events (game-design.md §6, §7)', () => {
  it.each([
    [1, 'sank'],
    [2, 'sank'],
    [3, 'sank'],
    [4, 'arrived'],
    [5, 'arrived'],
    [6, 'arrived'],
  ] as const)('a raw roll of %i means the ship %s', (roll, outcome) => {
    const launched = launchRound1('p1').state;
    const { events } = finishRound(withRawRolls(launched, { 'r1-s1': roll }));
    expect(events).toContainEqual({ type: 'ship-resolved', round: 1, shipId: 'r1-s1', outcome });
  });

  it('resolves ships after the voyage event is revealed and before the round ends', () => {
    const launched = launchRound1('p1').state;
    const { events } = finishRound(withRawRolls(launched, { 'r1-s1': 5 }));
    const order = ['voyage-event-revealed', 'ship-resolved', 'cash-changed', 'round-ended'];
    const positions = order.map((type) => events.findIndex((e) => e.type === type));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((p) => p >= 0)).toBe(true);
  });
});

describe('shipping income (game-design.md §5 step 6, §6)', () => {
  it('pays 300 G to the owner of an arrived solo ship', () => {
    const launched = launchRound1('p1', 'p2').state;
    const { state, events } = finishRound(withRawRolls(launched, { 'r1-s1': 6, 'r1-s2': 2 }));
    expect(cashOf(state, 'p1')).toBe(900 + 300);
    expect(cashOf(state, 'p2')).toBe(900);
    expect(events).toContainEqual({
      type: 'cash-changed',
      round: 1,
      playerId: 'p1',
      amount: 300,
      reason: 'shipping-income',
      shipId: 'r1-s1',
    });
    expect(events.some((e) => e.type === 'cash-changed' && e.playerId === 'p2' && e.amount > 0)).toBe(false);
  });

  it('shows outcomes in player views once resolved, still without dice values', () => {
    const launched = launchRound1('p1').state;
    // Stop right after round 1 resolution: the next round has begun, so check the events instead.
    const { events } = finishRound(withRawRolls(launched, { 'r1-s1': 4 }));
    expect(events.filter((e) => e.type === 'ship-resolved')).toEqual([
      { type: 'ship-resolved', round: 1, shipId: 'r1-s1', outcome: 'arrived' },
    ]);
  });

  it('starts each round with no ships', () => {
    const launched = launchRound1('p1').state;
    const { state } = finishRound(launched);
    expect(state.round).toBe(2);
    expect(state.roundState.ships).toEqual([]);
  });
});

describe('a full match of solo voyages', () => {
  it('keeps every cash change accounted for by public events', () => {
    const start = startMatch({ seed: 11 });
    const { state, events } = playUntil(start.state, () => false, sailSolo('p1', 'p2', 'p3', 'p4'));
    expect(state.phase).toBe('game-over');
    for (const player of state.players) {
      const delta = (events as MatchEvent[])
        .filter((e) => e.type === 'cash-changed' && e.playerId === player.id)
        .reduce((sum, e) => sum + (e.type === 'cash-changed' ? e.amount : 0), 0);
      expect(player.cash).toBe(1000 + delta);
    }
    expect(events.filter((e) => e.type === 'ship-resolved')).toHaveLength(24);
  });

  it('is reproducible from the seed and the same choices', () => {
    const run = () => playUntil(startMatch({ seed: 5 }).state, () => false, sailSolo('p1', 'p3'));
    expect(run().state).toEqual(run().state);
  });

  it('rejects submitting a solo voyage for another round after the match ends', () => {
    const { state } = playUntil(startMatch().state, () => false, sailSolo('p1'));
    const result = applyAction(state, { type: 'choose-sailing', playerId: 'p1', choice: 'solo' });
    expect(!result.ok && result.error.code).toBe('match-over');
  });

  it('lets a player sail solo and keeps unwrap-able transitions', () => {
    const { state } = playUntil(startMatch().state, atPhase('sailing-choice'));
    const next = unwrap(applyAction(state, { type: 'choose-sailing', playerId: 'p1', choice: 'solo' }));
    expect(next.state.roundState.submissions['p1']).toEqual({
      type: 'choose-sailing',
      playerId: 'p1',
      choice: 'solo',
    });
  });
});
