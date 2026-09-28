import { describe, expect, it } from 'vitest';
import { applyAction, getPlayerView } from '../../src/game';
import { playFirstLegalToEnd, startMatch, unwrap } from './helpers';

describe('getPlayerView (architecture.md §4.3)', () => {
  it('exposes public match information', () => {
    const { state } = startMatch();
    const view = getPlayerView(state, 'p1');
    expect(view).toMatchObject({
      playerId: 'p1',
      round: 1,
      totalRounds: 6,
      phase: 'asset-purchase',
      marketEvent: state.roundState.marketEvent,
      voyageEvent: null,
      marketDeckRemaining: 11,
      voyageDeckRemaining: 14,
      pendingDecision: 'asset-purchase',
      mySubmission: null,
      result: null,
    });
    expect(view.players.map((p) => [p.id, p.name, p.cash, p.assets])).toEqual([
      ['p1', 'Alice', 1000, []],
      ['p2', 'Bob', 1000, []],
      ['p3', 'Carol', 1000, []],
      ['p4', 'Dave', 1000, []],
    ]);
  });

  it('includes the public rule numbers so bots and UI can reason about costs', () => {
    const { state } = startMatch();
    expect(getPlayerView(state, 'p1').rules).toEqual(state.rules);
  });

  it('hides rng state and deck order', () => {
    const view = getPlayerView(startMatch().state, 'p1') as unknown as Record<string, unknown>;
    expect(view).not.toHaveProperty('rng');
    expect(view).not.toHaveProperty('marketDeck');
    expect(view).not.toHaveProperty('voyageDeck');
    expect(view).not.toHaveProperty('roundState');
  });

  it('shows who has submitted, but only your own submission', () => {
    const { state } = startMatch();
    const next = unwrap(applyAction(state, { type: 'buy-asset', playerId: 'p2', asset: null })).state;
    const p1View = getPlayerView(next, 'p1');
    const p2View = getPlayerView(next, 'p2');
    expect(p1View.submittedPlayerIds).toEqual(['p2']);
    expect(p1View.mySubmission).toBeNull();
    expect(p1View.pendingDecision).toBe('asset-purchase');
    expect(p2View.mySubmission).toEqual({ type: 'buy-asset', playerId: 'p2', asset: null });
    expect(p2View.pendingDecision).toBeNull();
    expect(JSON.stringify(p1View)).not.toContain('"playerId":"p2","asset"');
  });

  it('includes the final result after the match ends', () => {
    const { state } = playFirstLegalToEnd(startMatch().state);
    const view = getPlayerView(state, 'p3');
    expect(view.phase).toBe('game-over');
    expect(view.result).toEqual(state.result);
    expect(view.pendingDecision).toBeNull();
  });

  it('throws for unknown players', () => {
    expect(() => getPlayerView(startMatch().state, 'ghost')).toThrow();
  });
});
