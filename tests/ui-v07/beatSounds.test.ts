import { describe, expect, it } from 'vitest';
import { beatSound } from '../../src/ui-v07/audio/beatSounds';
import type { BeatView } from '../../src/ui-v07/beats/beatTimeline';
import type { BeatStep, ShipBeat } from '../../src/ui-v07/beats/shipBeat';

const step = (kind: BeatStep['kind'], source: BeatStep['source'] = null): BeatStep => ({ kind, delta: 1, value: 4, actors: [], boosted: [], source });

const beat = (steps: BeatStep[], outcome: ShipBeat['outcome'] = 'arrived'): ShipBeat => ({
  round: 1,
  shipId: 's1',
  owner: 'p1',
  start: 3,
  rerolled: false,
  rerollSpotter: null,
  steps,
  final: 4,
  outcome,
  cargo: { wood: 1, iron: 0, spice: 0, arms: 0 },
  smugglers: [],
  smuggling: null,
  armsConfiscated: 0,
  cash: [],
  goods: [],
});

const view = (over: Partial<BeatView>): BeatView => ({
  started: 0,
  showStart: false,
  stepsShown: 0,
  die: null,
  showOutcome: false,
  showCargo: false,
  cashShown: 0,
  goodsShown: 0,
  done: false,
  ...over,
});

describe('sound of each moment in a ship beat', () => {
  const b = beat([step('guard'), step('pirate'), step('event', 'storm'), step('island', 'lighthouse'), step('clamp')]);

  it('rolls the die when the start value shows', () => {
    expect(beatSound(b, null, view({ showStart: true }))).toBe('dice');
    expect(beatSound(b, view({ showStart: true }), view({ showStart: true }))).toBeNull();
  });

  // The storm's step (null here) sounds with the bolt's flash in the scene instead.
  it('gives each modifier its own sound', () => {
    const at = (n: number) => beatSound(b, view({ showStart: true, stepsShown: n - 1 }), view({ showStart: true, stepsShown: n }));
    expect([1, 2, 3, 4, 5].map(at)).toEqual(['guard', 'pirate', null, 'island', null]);
  });

  it('sounds the voyage event that changed the die', () => {
    const of = (source: BeatStep['source']) => beatSound(beat([step('event', source)]), view({ showStart: true }), view({ showStart: true, stepsShown: 1 }));
    expect(of('tailwind')).toBe('event-tailwind');
    expect(of('sea-fog')).toBe('event-fog');
    expect(of('moonless-night')).toBe('event-moonless');
  });

  it('docks or sinks the ship at the outcome', () => {
    const shown = view({ showStart: true, stepsShown: 5 });
    expect(beatSound(b, shown, { ...shown, showOutcome: true })).toBe('arrive');
    expect(beatSound(beat([], 'sank'), view({ showStart: true }), view({ showStart: true, showOutcome: true }))).toBe('sink');
  });

  it('plays only the latest moment when a skip jumps over several', () => {
    expect(beatSound(b, null, view({ showStart: true, stepsShown: 5, showOutcome: true }))).toBe('arrive');
    expect(beatSound(b, null, view({ showStart: true, stepsShown: 2 }))).toBe('pirate');
  });
});
