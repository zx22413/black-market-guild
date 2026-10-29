import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../../../src/v07/game';
import { TRAILER, TUTORIALS, playTutorial } from '../../../src/v07/tutorial';

// The trailer is filmed from this script (docs/promo/launch-kit.md §5): if a rule change moves any
// of these beats, the video no longer shows what the game does.

const log = playTutorial(TRAILER);
const shipOf = (round: number, owner: string) =>
  log.events.flatMap((e) => (e.type === 'ships-launched' && e.round === round ? e.ships : [])).find((s) => s.owner === owner)!.id;
const modifier = (round: number, owner: string) =>
  log.events.flatMap((e) => (e.type === 'voyage-modifiers' && e.round === round ? e.modifiers : [])).find((m) => m.shipId === shipOf(round, owner));
const outcome = (round: number, owner: string) =>
  log.events.find((e): e is Extract<MatchEvent, { type: 'ship-resolved' }> => e.type === 'ship-resolved' && e.shipId === shipOf(round, owner))?.outcome;
const market = (round: number) => log.events.find((e): e is Extract<MatchEvent, { type: 'market-settled' }> => e.type === 'market-settled' && e.round === round)!;

describe('the trailer script', () => {
  it('is not offered as a lesson', () => {
    expect(TUTORIALS).not.toContain(TRAILER);
  });

  it('crashes wood and spice in round 1', () => {
    const { priceBefore, priceAfter } = market(1);
    expect(priceAfter.wood).toBe(priceBefore.wood - 1);
    expect(priceAfter.spice).toBe(priceBefore.spice - 2);
  });

  it('lands your ship on a 3 through guard, pirate and storm in round 2', () => {
    expect(modifier(2, 'p1')).toMatchObject({ base: 4, guard: 1, pirate: -1, event: -1, final: 3 });
    expect(outcome(2, 'p1')).toBe('arrived');
    expect(log.events.some((e) => e.type === 'smuggling-settled' && e.round === 2 && e.result === 'caught')).toBe(true);
  });

  it('sinks 凡德商行 to the storm alone in round 2', () => {
    expect(modifier(2, 'p2')).toMatchObject({ base: 3, guard: 0, pirate: 0, event: -1, final: 2 });
    expect(outcome(2, 'p2')).toBe('sank');
  });
});
