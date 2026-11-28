import { describe, expect, it } from 'vitest';
import { FIREWORKS, TIDE_RIPPLE, crowdCue, fireworkCue, roundCardCues, tideRippleCue } from '../../src/ui-v07/audio/roundCardSounds';
import { sweepCues } from '../../src/ui-v07/audio/roundCardSounds';
import { SWEEP } from '../../src/ui-v07/table3d/tideSweepShow';
import type { RoundCard } from '../../src/ui-v07/table3d/roundCard';
import { TIDE_CARD, type TideKind, type VoyageEventId } from '../../src/v07/game';

const voyage = (boss: boolean, flip = false, event: VoyageEventId = 'storm'): RoundCard => ({
  kind: 'voyage',
  event,
  boss,
  title: '',
  lines: [],
  ...(flip ? { flipFrom: { title: '', lines: [] } } : {}),
});
const rising: RoundCard = { kind: 'rising', candidates: ['storm', 'pirate'], tide: 'storm', title: '', lines: [] };
const ids = (cues: readonly { readonly id: string }[]) => cues.map((c) => c.id);

describe('sound of the round cards, on their motion', () => {
  it('plays 暗潮將至 as a short wave, then the bell on its pick at 1.5 s', () => {
    expect(roundCardCues(rising, 'show')).toEqual([
      { at: 0, id: 'tide-wave', rate: 1 },
      { at: 1.5, id: 'tide-pick', rate: 1 },
    ]);
  });

  it('lets the drops come only after the bell, then one with every ring of water while the card is up', () => {
    const times = [0, 1, 2, 3].map((i) => tideRippleCue(i).at);
    expect(times[0]).toBeGreaterThan(1.5);
    expect(times).toEqual([0, 1, 2, 3].map((i) => TIDE_RIPPLE.first + i * TIDE_RIPPLE.period));
    expect(new Set([0, 1, 2].map((i) => tideRippleCue(i).rate)).size).toBe(3);
  });

  it("turns a first dark side over into its own tide's sound (cut onto the flash), not a storm for every tide", () => {
    expect(ids(roundCardCues(voyage(true, true), 'show'))).toEqual(['card-in']);
    for (const tide of Object.keys(TIDE_CARD) as TideKind[]) {
      expect(roundCardCues(voyage(true, true, TIDE_CARD[tide]), 'turn')).toEqual([{ at: 0, id: `boss-flip-${tide}`, rate: 1 }]);
    }
  });

  it("lands a later dark side with its tide's sound, and leaves a plain voyage event silent", () => {
    expect(ids(roundCardCues(voyage(true, false, 'sea-fog'), 'show'))).toEqual(['card-in', 'boss-hit-pirate']);
    expect(ids(roundCardCues(voyage(true, false, 'calm-seas'), 'show'))).toEqual(['card-in', 'boss-hit-crash']);
    expect(roundCardCues(voyage(false), 'show')).toEqual([]);
  });

  it('sets off a volley every round of shells on 最後的大市集, quieter each time, over a crowd, for as long as the card is up', () => {
    const final: RoundCard = { kind: 'final', effect: 'final-market', title: '', lines: [] };
    expect(ids(roundCardCues(final, 'show'))).toEqual(['card-in']);
    expect([0, 1, 2].map((i) => fireworkCue(i).at)).toEqual([0, FIREWORKS.period, 2 * FIREWORKS.period]);
    expect(fireworkCue(1).gain ?? 1).toBeLessThan(fireworkCue(0).gain ?? 1);
    expect(fireworkCue(60).gain ?? 1).toBeGreaterThan(0);
    expect([0, 1].map((i) => crowdCue(i).at)).toEqual([0, FIREWORKS.crowd]);
    expect(roundCardCues({ kind: 'final', effect: null, title: '', lines: [] }, 'show')).toEqual([]);
  });
});

describe('sound of the tide taking the goods', () => {
  it('splashes once for each crate in the longest row, as it goes under', () => {
    const cues = sweepCues(3);
    expect(ids(cues)).toEqual(['sweep-surge', 'crate-sink', 'crate-sink', 'crate-sink']);
    const sinks = cues.filter((c) => c.id === 'crate-sink').map((c) => c.at);
    const first = SWEEP.surge * 0.6 + SWEEP.drift;
    expect(sinks[0]).toBeCloseTo(first);
    expect(sinks[2]! - sinks[0]!).toBeCloseTo(2 * SWEEP.stagger);
  });
});
