import { describe, expect, it } from 'vitest';
import { RULES_V08, type MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { beatSound } from '../../src/ui-v07/audio/beatSounds';
import { BEAT_PACE, beatCues, beatView } from '../../src/ui-v07/beats/beatTimeline';
import { gambleOf, gambleText } from '../../src/ui-v07/beats/gambleShow';
import { buildShipBeat, type ShipBeat } from '../../src/ui-v07/beats/shipBeat';
import type { SkillMoment } from '../../src/ui-v07/beats/skillShow';

// 最後的大市集 (game-design.md §12.1): every ship throws two dice and the higher one counts. The show throws both and
// knocks the low one away, from the dice the engine publishes with the round's modifiers.

const seats: SeatConfig[] = ['A', 'B', 'C', 'D'].map((name, i) => ({ kind: 'bot', name, strategy: (['aggressive', 'balanced', 'aggressive', 'builder'] as const)[i]! }));

function play(seed: number): MatchEvent[] {
  const setup = setupFromSeats({ seed, seats, rules: RULES_V08 });
  return runMatchSync(setup, setup.bots).events as MatchEvent[];
}

const beat = (over: Partial<ShipBeat>): ShipBeat => ({
  round: 8,
  shipId: 's1',
  owner: 'p1',
  type: 'standard',
  start: 5,
  steps: [],
  final: 5,
  outcome: 'arrived',
  cargo: { wood: 1, iron: 0, spice: 0, arms: 0 },
  lost: null,
  dropped: [],
  skills: [],
  gamble: gambleOf([2, 5]),
  smugglers: [],
  smuggling: null,
  confiscated: [],
  cash: [],
  goods: [],
  ...over,
});

const at = (b: ShipBeat, kind: string, nth = 0) => {
  const cues = beatCues(b);
  const index = cues.flatMap((c, i) => (c.kind === kind ? [i] : []))[nth]!;
  return beatView(b, cues, index + 1);
};

describe('the dice of the final market', () => {
  it('keeps the highest die, the first one on a tie', () => {
    expect(gambleOf([2, 5])).toEqual({ dice: [2, 5], kept: 1, value: 5, tie: false });
    expect(gambleOf([4, 4])).toEqual({ dice: [4, 4], kept: 0, value: 4, tie: true });
    expect(gambleOf([6, 1, 3])?.kept).toBe(0);
    expect(gambleOf([3])).toBeNull();
    expect(gambleOf(undefined)).toBeNull();
  });

  it('says what was thrown only once the dice have landed', () => {
    expect(gambleText(gambleOf([2, 5])!, false)).toEqual({ title: '最後一搏', note: '擲 2 顆，取高的' });
    expect(gambleText(gambleOf([2, 5])!, true)).toEqual({ title: '取高的 5', note: '擲出 2 與 5' });
    expect(gambleText(gambleOf([4, 4])!, true)).toEqual({ title: '取高的 4', note: '兩顆都是 4' });
  });

  it.each([1, 2, 3])('are on every ship of the last round and on no ship before it (seed %i)', (seed) => {
    const events = play(seed);
    const last = Math.max(...events.flatMap((e) => (e.type === 'ship-resolved' ? [e.round] : [])));
    const mods = events.flatMap((e) => (e.type === 'voyage-modifiers' ? e.modifiers.map((m) => ({ ...m, round: e.round })) : []));
    expect(mods.some((m) => m.dice !== undefined)).toBe(true);
    for (const m of mods) {
      const b = buildShipBeat(events, m.shipId)!;
      if (m.dice === undefined) {
        expect(b.gamble).toBeNull();
        continue;
      }
      expect(m.round).toBe(last);
      expect(b.gamble?.dice).toEqual(m.dice);
      expect(b.gamble?.dice).toHaveLength(RULES_V08.v08.events.lastGambleDice);
    }
  });
});

describe('the final market in a ship beat', () => {
  it('throws the dice, then picks the high one, before anything else touches the die', () => {
    const guard = { kind: 'guard' as const, delta: 1, value: 6, actors: ['p2'], boosted: [], source: null };
    const b = beat({ steps: [guard], final: 6 });
    expect(beatCues(b).map((c) => c.kind)).toEqual(['intro', 'start', 'gamble', 'step', 'outcome', 'cargo', 'done']);
    expect(at(b, 'intro').gamble).toBeNull();
    expect(at(b, 'start').gamble).toBe('thrown');
    expect(at(b, 'gamble').gamble).toBe('picked');
    expect(at(b, 'gamble').die).toBe(5);
    // From the first modifier on it is one die again.
    expect(at(b, 'step').gamble).toBeNull();
    expect(at(b, 'step').die).toBe(6);
    expect(at(beat({}), 'outcome').gamble).toBeNull();
  });

  it('gives both moments time: the dice land one after the other, then the low one goes', () => {
    const cues = beatCues(beat({}));
    const start = cues.find((c) => c.kind === 'start')!;
    const pick = cues.find((c) => c.kind === 'gamble')!;
    const after = cues[cues.indexOf(pick) + 1]!;
    expect(pick.at - start.at).toBe(BEAT_PACE.gambleThrow);
    expect(after.at - pick.at).toBe(BEAT_PACE.gamblePick);
    // A fast-forwarded ship still shows both in full.
    const fast = beatCues(beat({}), 4);
    expect(fast.find((c) => c.kind === 'gamble')!.at - fast.find((c) => c.kind === 'start')!.at).toBe(BEAT_PACE.gambleThrow);
  });

  it('plays no pick for a ship that threw one die', () => {
    const b = beat({ gamble: null });
    expect(beatCues(b).map((c) => c.kind)).toEqual(['intro', 'start', 'outcome', 'cargo', 'done']);
    expect(at(b, 'start').gamble).toBeNull();
  });

  it('shows the dice thrown until a reroll replaces them', () => {
    const reroll: SkillMoment = { playerId: 'p1', shipId: 's1', effect: 'reroll', at: 'die', name: '好兆頭', text: '重擲', tone: 'gain', added: 0 };
    const b = beat({ gamble: gambleOf([1, 2]), start: 5, skills: [reroll] });
    expect(at(b, 'gamble').die).toBe(2);
    expect(at(b, 'skill').die).toBe(5);
  });

  it('shows the roll without the extra die until it goes off', () => {
    const extra: SkillMoment = { playerId: 'p1', shipId: 's1', effect: 'extra-die', at: 'die', name: '巨浪', text: '再加 3', tone: 'gain', added: 3 };
    const b = beat({ type: 'breaker', gamble: gambleOf([4, 6]), start: 9, final: 9, skills: [extra] });
    expect(at(b, 'gamble').die).toBe(6);
    expect(at(b, 'skill').die).toBe(9);
  });

  it('sounds the dice on the throw and the pick as the low die goes', () => {
    const b = beat({});
    expect(beatSound(b, at(b, 'intro'), at(b, 'start'))).toBe('dice');
    expect(beatSound(b, at(b, 'start'), at(b, 'gamble'))).toBe('gamble-pick');
    expect(beatSound(b, at(b, 'gamble'), at(b, 'gamble'))).toBeNull();
  });
});
