import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createMatch,
  getLegalActions,
  getPendingDecisions,
  RULES_V06,
} from '../../src/game';
import { config, deepFreeze, FOUR_PLAYERS, playFirstLegalToEnd, startMatch, unwrap } from './helpers';

describe('createMatch validation (game-design.md §3)', () => {
  it.each([
    ['2 players', FOUR_PLAYERS.slice(0, 2)],
    ['5 players', [...FOUR_PLAYERS, { id: 'p5', name: 'Eve' }]],
  ])('rejects %s because the core game is 3-4 players', (_label, players) => {
    const result = createMatch(config({ players }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('invalid-config');
  });

  it('accepts 3 players', () => {
    expect(createMatch(config({ players: FOUR_PLAYERS.slice(0, 3) })).ok).toBe(true);
  });

  it('rejects duplicate player ids', () => {
    const players = [FOUR_PLAYERS[0], FOUR_PLAYERS[1], { id: 'p1', name: 'Clone' }];
    expect(createMatch(config({ players })).ok).toBe(false);
  });

  it('rejects empty player ids or names', () => {
    const players = [FOUR_PLAYERS[0], FOUR_PLAYERS[1], { id: '', name: 'X' }];
    expect(createMatch(config({ players })).ok).toBe(false);
    const unnamed = [FOUR_PLAYERS[0], FOUR_PLAYERS[1], { id: 'p3', name: ' ' }];
    expect(createMatch(config({ players: unnamed })).ok).toBe(false);
  });

  it('rejects a non-integer seed', () => {
    expect(createMatch(config({ seed: 1.5 })).ok).toBe(false);
  });

  it.each([
    ['zero rounds', { ...RULES_V06, rounds: 0 }],
    ['fractional rounds', { ...RULES_V06, rounds: 2.5 }],
    ['min players above max', { ...RULES_V06, players: { min: 4, max: 3 } }],
  ])('rejects self-contradictory rules: %s', (_label, rules) => {
    const result = createMatch(config({ rules }));
    expect(!result.ok && result.error.code).toBe('invalid-config');
  });

  it('rejects rules whose decks cannot cover every round', () => {
    const rules = { ...RULES_V06, rounds: 20 };
    expect(createMatch(config({ rules })).ok).toBe(false);
  });
});

describe('match start', () => {
  it('gives every player 1000 G and no assets', () => {
    const { state } = startMatch();
    expect(state.players.map((p) => [p.cash, p.assets])).toEqual(
      FOUR_PLAYERS.map(() => [1000, []]),
    );
  });

  it('starts round 1 by revealing a market event, then asks everyone about assets', () => {
    const { state, events } = startMatch();
    expect(state.round).toBe(1);
    expect(state.phase).toBe('asset-purchase');
    expect(events[0]).toEqual({ type: 'round-started', round: 1 });
    expect(events[1]).toEqual({
      type: 'market-event-revealed',
      round: 1,
      event: state.roundState.marketEvent,
    });
    expect(state.marketDeck).toHaveLength(11);
    expect(state.voyageDeck).toHaveLength(14);
    expect(getPendingDecisions(state).map((d) => d.playerId)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('is deterministic for the same seed and differs across seeds', () => {
    expect(startMatch({ seed: 7 }).state).toEqual(startMatch({ seed: 7 }).state);
    const decks = new Set(
      [1, 2, 3, 4, 5].map((seed) => JSON.stringify(startMatch({ seed }).state.marketDeck)),
    );
    expect(decks.size).toBeGreaterThan(1);
  });
});

describe('applyAction validation', () => {
  it('rejects unknown players', () => {
    const { state } = startMatch();
    const result = applyAction(state, { type: 'buy-asset', playerId: 'ghost', asset: null });
    expect(!result.ok && result.error.code).toBe('unknown-player');
  });

  it('rejects actions for another phase', () => {
    const { state } = startMatch();
    const result = applyAction(state, { type: 'recruit', playerId: 'p1', recruit: false });
    expect(!result.ok && result.error.code).toBe('wrong-phase');
  });

  it('rejects a second submission in the same phase', () => {
    const { state } = startMatch();
    const first = unwrap(applyAction(state, { type: 'buy-asset', playerId: 'p1', asset: null }));
    const second = applyAction(first.state, { type: 'buy-asset', playerId: 'p1', asset: null });
    expect(!second.ok && second.error.code).toBe('already-submitted');
  });

  it('rejects actions that are not among the legal options', () => {
    const { state } = startMatch();
    const legal = getLegalActions(state, 'p1');
    expect(legal.length).toBeGreaterThan(0);
    const result = applyAction(state, { type: 'buy-asset', playerId: 'p1', asset: 'nonexistent' as never });
    expect(!result.ok && result.error.code).toBe('illegal-action');
  });

  it('rejects any action after the match is over', () => {
    const { state } = playFirstLegalToEnd(startMatch().state);
    const result = applyAction(state, { type: 'buy-asset', playerId: 'p1', asset: null });
    expect(!result.ok && result.error.code).toBe('match-over');
  });

  it('never mutates the input state', () => {
    const { state } = startMatch();
    deepFreeze(state);
    expect(() => applyAction(state, { type: 'buy-asset', playerId: 'p1', asset: null })).not.toThrow();
  });

  it('keeps the phase open until every decider has submitted', () => {
    const { state } = startMatch();
    const afterOne = unwrap(applyAction(state, { type: 'buy-asset', playerId: 'p1', asset: null }));
    expect(afterOne.state.phase).toBe('asset-purchase');
    expect(getPendingDecisions(afterOne.state).map((d) => d.playerId)).toEqual(['p2', 'p3', 'p4']);
  });
});

describe('a full match where nobody acts (M1)', () => {
  it('runs exactly 6 rounds and ends with everyone tied at 1000 G', () => {
    const { state, events } = playFirstLegalToEnd(startMatch().state);
    expect(state.phase).toBe('game-over');
    expect(state.round).toBe(6);
    expect(events.filter((e) => e.type === 'round-ended').map((e) => e.round)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(state.result?.winners).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(state.result?.standings.every((s) => s.wealth === 1000 && s.rank === 1)).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'match-ended', result: state.result });
  });

  it('draws one market event per round and one voyage event per round', () => {
    const start = startMatch();
    const { state, events: played } = playFirstLegalToEnd(start.state);
    const events = [...start.events, ...played];
    expect(events.filter((e) => e.type === 'market-event-revealed')).toHaveLength(6);
    expect(events.filter((e) => e.type === 'voyage-event-revealed')).toHaveLength(6);
    expect(state.marketDeck).toHaveLength(6);
    expect(state.voyageDeck).toHaveLength(8);
  });

  it('reveals the voyage event only after role deployment', () => {
    const { events } = playFirstLegalToEnd(startMatch().state);
    const round1 = events.slice(0, events.findIndex((e) => e.type === 'round-ended'));
    const deployment = round1.findIndex((e) => e.type === 'phase-started' && e.phase === 'role-deployment');
    const voyage = round1.findIndex((e) => e.type === 'voyage-event-revealed');
    expect(deployment).toBeGreaterThan(-1);
    expect(voyage).toBeGreaterThan(deployment);
  });

  it('skips phases where nobody has a decision to make', () => {
    const { events } = playFirstLegalToEnd(startMatch().state);
    const phases = events.filter((e) => e.type === 'phase-started').map((e) => e.phase);
    expect(phases).not.toContain('apply');
    expect(phases).not.toContain('pick');
    expect(phases).not.toContain('intel-reroll');
  });

  it('can be serialized to JSON mid-match and resumed with the same outcome', () => {
    const { state: start } = startMatch({ seed: 3 });
    const direct = playFirstLegalToEnd(start);
    const midway = unwrap(applyAction(start, { type: 'buy-asset', playerId: 'p1', asset: null })).state;
    const revived = JSON.parse(JSON.stringify(midway));
    const resumed = playFirstLegalToEnd(revived);
    expect(resumed.state).toEqual(direct.state);
  });
});
