import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createMatch,
  createRng,
  getLegalActions,
  getPendingDecisions,
  getPlayerView,
  type MatchEvent,
  type MatchState,
  type PrivateEvent,
} from '../../../src/v07/game';

interface Played {
  readonly state: MatchState;
  readonly events: MatchEvent[];
  readonly privateEvents: PrivateEvent[];
  readonly actions: number;
}

/** Plays a whole match with uniformly random legal actions. */
export function playRandom(seed: number, players: number): Played {
  const created = createMatch({ seed, players: Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })) });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  const rng = createRng(seed * 7919 + 1);
  let state = created.value.state;
  const events = [...created.value.events];
  const privateEvents = [...created.value.privateEvents];
  let actions = 0;
  while (state.phase !== 'game-over') {
    const [next] = getPendingDecisions(state);
    if (next === undefined) {
      throw new Error(`stuck in ${state.phase}`);
    }
    const legal = getLegalActions(state, next.playerId);
    const action = legal[rng.int(0, legal.length - 1)]!;
    const result = applyAction(state, action);
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    state = result.value.state;
    events.push(...result.value.events);
    privateEvents.push(...result.value.privateEvents);
    actions += 1;
  }
  return { state, events, privateEvents, actions };
}

describe('V0.7 random matches', () => {
  it.each([3, 4])('finish with %i players and keep the invariants', (players) => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const { state, events } = playRandom(seed, players);
      expect(state.round).toBe(6);
      expect(state.result?.standings).toHaveLength(players);
      state.players.forEach((p) => {
        expect(p.cash).toBeGreaterThanOrEqual(0);
        expect(Object.values(p.stock).every((n) => n >= 0)).toBe(true);
        expect(p.buildings.length).toBeLessThanOrEqual(2);
        expect(p.island).not.toBeNull();
      });
      expect(new Set(state.players.map((p) => p.island)).size).toBe(players);
      expect(events.at(-1)?.type).toBe('match-ended');
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
      expect(() => getPlayerView(state, 'p1')).not.toThrow();
    }
  });

  it('is reproducible from the seed', () => {
    const a = playRandom(11, 4);
    const b = playRandom(11, 4);
    expect(b.state).toEqual(a.state);
    expect(b.events).toEqual(a.events);
    expect(b.privateEvents).toEqual(a.privateEvents);
  });

  it('never puts cargo into public events before a ship resolves', () => {
    const { events } = playRandom(5, 4);
    events
      .filter((e) => e.type === 'ships-launched')
      .forEach((e) => expect(JSON.stringify(e)).not.toContain('cargo'));
  });
});
