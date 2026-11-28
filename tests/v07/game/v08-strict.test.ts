import { describe, expect, it } from 'vitest';
import { RULES_V08, priceAt, type MatchEvent, type MatchState, type V08EventsState, type VoyageEventId } from '../../../src/v07/game';
import { G, edit, find, plain, playRound, withDemand } from './helpers';

// game-design.md §12.1 (2026-11-28): 嚴查, the inspection tide's boss side of 黑市熱絡, also takes one arms crate off
// each covered ship (v08.events.bossCoveredArmsLoss), on top of lowering the allowance.

const V08 = RULES_V08;

/** Round 1 in phase II under the inspection tide, arms demand 2, everyone holding 3 arms. */
const inInspectionTide = (): MatchState => {
  const base = withDemand(plain(4, V08), G(2, 2, 2, 2));
  const stocked = base.players.reduce((s, p) => edit(s, p.id, { stock: G(3, 3, 1, 3) }), base);
  const patch: Partial<V08EventsState> = { phaseTwoFrom: 1, tide: 'inspection' };
  return { ...stocked, v08Events: { ...stocked.v08Events!, ...patch } };
};
const crates = (events: readonly MatchEvent[], effect: 'inspected' | 'inspection-covered', playerId: string): number =>
  find(events, 'v08-effect')
    .filter((e) => e.effect === effect && e.playerId === playerId)
    .reduce((n, e) => n + e.crates, 0);
/** p1 covers its own ship with its smuggler and carries `armsP1`; p2 carries `armsP2` uncovered. */
const sail = (voyageEvent: VoyageEventId, loadP1 = G(0, 0, 0, 3), armsP2 = 1) =>
  playRound(inInspectionTide(), { loads: { p1: loadP1, p2: G(0, 0, 0, armsP2) }, voyageEvent, roles: { p1: ['smuggler', 'p1'] } });

describe('V0.8 嚴查: a covered ship loses one arms crate', () => {
  it('is on in the current rules', () => {
    expect(V08.v08.events.bossCoveredArmsLoss).toBe(1);
  });

  it('takes one crate off the covered ship and every uncovered crate (the worked example in §12.1)', () => {
    const { state, events } = sail('black-market-rush');
    expect(crates(events, 'inspected', 'p1')).toBe(1);
    expect(crates(events, 'inspected', 'p2')).toBe(1);
    // p1 sells the other two at the new price; seized crates still count as arrivals (4 against demand 2).
    expect(find(events, 'market-settled')[0]!.arrived.arms).toBe(4);
    const sale = find(events, 'cash-changed').filter((e) => e.reason === 'sale' && e.playerId === 'p1').reduce((n, e) => n + e.amount, 0);
    expect(sale).toBe(2 * priceAt(V08, 'arms', state.prices.arms));
  });

  it('reports what the cover still kept: what it would have lost, less the crate 嚴查 took', () => {
    const { events } = sail('black-market-rush');
    // Uncovered, all 4 crates would go (allowance 0 − 1 − 1 against demand 2): 3 from p1, so the cover kept 2.
    expect(crates(events, 'inspection-covered', 'p1')).toBe(2);
  });

  it('leaves the covered ship alone without 嚴查 (查緝潮 alone)', () => {
    const { events } = sail('calm-seas');
    expect(crates(events, 'inspected', 'p1')).toBe(0);
    expect(crates(events, 'inspected', 'p2')).toBe(1);
  });

  it('takes nothing from a covered ship with no arms aboard', () => {
    const { events } = sail('black-market-rush', G(1), 1);
    expect(crates(events, 'inspected', 'p1')).toBe(0);
  });
});
