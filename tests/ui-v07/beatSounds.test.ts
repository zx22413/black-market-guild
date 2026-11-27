import { describe, expect, it } from 'vitest';
import { beatSound } from '../../src/ui-v07/audio/beatSounds';
import type { BeatView } from '../../src/ui-v07/beats/beatTimeline';
import type { BeatStep, ShipBeat } from '../../src/ui-v07/beats/shipBeat';

const step = (kind: BeatStep['kind'], source: BeatStep['source'] = null): BeatStep => ({ kind, delta: 1, value: 4, actors: [], boosted: [], source });

const beat = (steps: BeatStep[], outcome: ShipBeat['outcome'] = 'arrived'): ShipBeat => ({
  round: 1,
  shipId: 's1',
  owner: 'p1',
  type: 'standard',
  start: 3,
  steps,
  final: 4,
  outcome,
  cargo: { wood: 1, iron: 0, spice: 0, arms: 0 },
  lost: null,
  dropped: [],
  skills: [],
  gamble: null,
  smugglers: [],
  smuggling: null,
  confiscated: [],
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
  gamble: null,
  dropsShown: 0,
  skillsShown: 0,
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

describe('sound of the V0.8 moments in a ship beat', () => {
  const skill = (effect: 'reroll' | 'extra-die' | 'raise-won' | 'raise-lost', at: 'die' | 'outcome'): ShipBeat['skills'][number] => ({
    playerId: 'p1',
    shipId: 's1',
    effect,
    at,
    name: '',
    text: '',
    tone: effect === 'raise-lost' ? 'loss' : 'gain',
    added: 0,
  });

  it('splashes each crate that goes overboard', () => {
    const b = { ...beat([]), dropped: ['wood', 'iron'] as const };
    const cargo = view({ showStart: true, showCargo: true });
    expect(beatSound(b, cargo, { ...cargo, dropsShown: 1 })).toBe('crate-drop');
    expect(beatSound(b, { ...cargo, dropsShown: 1 }, { ...cargo, dropsShown: 2 })).toBe('crate-drop');
    expect(beatSound(b, { ...cargo, dropsShown: 2 }, { ...cargo, dropsShown: 2 })).toBeNull();
  });

  it('gives the lucky reroll and the big wave their own sound on the die', () => {
    const b = { ...beat([]), skills: [skill('reroll', 'die'), skill('extra-die', 'die')] };
    const rolled = view({ showStart: true });
    expect(beatSound(b, rolled, { ...rolled, skillsShown: 1 })).toBe('skill-omen');
    expect(beatSound(b, { ...rolled, skillsShown: 1 }, { ...rolled, skillsShown: 2 })).toBe('skill-surge');
  });

  it('rings the jackpot for a raise that came in, and sinks one that did not', () => {
    const shown = view({ showStart: true });
    const won = { ...beat([]), skills: [skill('raise-won', 'outcome')] };
    const lost = { ...beat([], 'sank'), skills: [skill('raise-lost', 'outcome')] };
    expect(beatSound(won, shown, { ...shown, showOutcome: true })).toBe('skill-raise-won');
    expect(beatSound(lost, shown, { ...shown, showOutcome: true })).toBe('sink');
  });
});
