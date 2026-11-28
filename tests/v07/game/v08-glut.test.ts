import { describe, expect, it } from 'vitest';
import { RULES_V08, type MatchState, type TideKind, type V08EventsState } from '../../../src/v07/game';
import { revealVoyageEvent } from '../../../src/v07/game/resolution';
import { buildBoard } from '../../../src/ui-v07/session/board';
import { G, edit, find, plain, playRound, withDemand, withPrices } from './helpers';

// game-design.md §12.1 (2026-11-28): 貨滿為患, the crash tide's boss side of 風平浪靜, lowers every good's demand by 1
// (v08.events.bossDemandShift) instead of doubling the drops.

const V08 = RULES_V08;
const vol = V08.price.volatility;

/** Round 1 in phase II under `tide`, with `demand` on the table and 風平浪靜 next in the deck. */
const calmAhead = (tide: TideKind, demand = G(2, 2, 1, 1)): MatchState => {
  const base = withDemand(plain(4, V08), demand);
  const stocked = base.players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 1) }), base);
  const patch: Partial<V08EventsState> = { phaseTwoFrom: 1, tide, deck: ['calm-seas', 'tailwind'] };
  return { ...stocked, v08Events: { ...stocked.v08Events!, ...patch } };
};

describe('V0.8 貨滿為患: demand −1', () => {
  it('replaces the doubled drops in the current rules', () => {
    expect(V08.v08.events.bossDemandShift).toBe(-1);
    expect(V08.v08.events.bossDropMultiplier).toBe(1);
  });

  it('lowers every good’s demand by 1, not below 0, and the boss event carries the new demand', () => {
    const step = revealVoyageEvent(calmAhead('crash', G(2, 3, 1, 0)));
    expect(step.state.roundState.demand).toEqual(G(1, 2, 0, 0));
    expect(find([...step.events], 'boss-event')).toMatchObject([{ event: 'calm-seas', demand: G(1, 2, 0, 0) }]);
  });

  it('leaves the demand alone when 風平浪靜 does not flip (another tide)', () => {
    const step = revealVoyageEvent(calmAhead('storm'));
    expect(step.state.roundState.demand).toEqual(G(2, 2, 1, 1));
    expect(find([...step.events], 'boss-event')).toHaveLength(0);
  });

  it('makes goods that just meet the card’s demand drop, by the crash tide’s doubled cells', () => {
    // Iron: demand 2 on the card, 2 arrive. Without the flip it holds; with 貨滿為患 demand is 1 and 崩盤潮 drops it 2×.
    const sail = (state: MatchState) =>
      find(playRound(withPrices(state, G(4, 4, 4, 4)), { loads: { p1: G(0, 2) }, voyageEvent: 'calm-seas' }).events, 'market-settled')[0]!.priceAfter.iron;
    expect(sail(calmAhead('crash'))).toBe(4);
    expect(sail(revealVoyageEvent(calmAhead('crash')).state)).toBe(4 - 2 * vol.iron);
  });

  it('inspects the arms against the lowered demand', () => {
    // Arms demand 1 on the card: one crate is fine; under 貨滿為患 the demand is 0 and the crate is seized.
    const inspected = (state: MatchState) =>
      find(playRound(state, { loads: { p1: G(0, 0, 0, 1) }, voyageEvent: 'calm-seas' }).events, 'v08-effect').filter((e) => e.effect === 'inspected');
    expect(inspected(calmAhead('storm'))).toHaveLength(0);
    expect(inspected(revealVoyageEvent(calmAhead('crash')).state)[0]?.crates).toBe(1);
  });

  it('shows the lowered demand on the table, and the final market’s raised demand too', () => {
    const board = buildBoard(['p1', 'p2', 'p3', 'p4'], 0, [
      { type: 'demand-revealed', round: 6, demand: G(2, 2, 1, 1), prices: G(2, 2, 3, 3) },
      { type: 'boss-event', round: 6, event: 'calm-seas', demand: G(1, 1, 0, 0) },
    ]);
    expect(board.demand).toEqual(G(1, 1, 0, 0));
    const final = buildBoard(['p1', 'p2', 'p3', 'p4'], 0, [
      { type: 'demand-revealed', round: 8, demand: G(1, 1, 1, 0), prices: G(2, 2, 3, 3) },
      { type: 'final-round', round: 8, effect: 'final-market', demand: G(2, 2, 2, 1) },
    ]);
    expect(final.demand).toEqual(G(2, 2, 2, 1));
  });
});
