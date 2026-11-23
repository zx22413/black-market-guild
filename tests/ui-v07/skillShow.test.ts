import { describe, expect, it } from 'vitest';
import { RULES_V08, type MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { beatCues, beatView } from '../../src/ui-v07/beats/beatTimeline';
import { buildShipBeat } from '../../src/ui-v07/beats/shipBeat';
import { skillMoments } from '../../src/ui-v07/beats/skillShow';

const fx = (effect: string, shipId: string | null, crates = 0, value = 0, playerId = 'p1'): MatchEvent => ({ type: 'v08-effect', round: 2, playerId, shipId, effect, crates, value }) as MatchEvent;

describe('ship skills going off (V0.8 prototype, not rules)', () => {
  it('words each skill and when it shows', () => {
    const events = [fx('reroll', 's1'), fx('reroll-saved', 's1'), fx('extra-die', 's2', 3, 200), fx('raise-won', 's3', 2, 450), fx('raise-lost', 's4'), fx('salvage', 's9', 1, 150, 'p2'), fx('repairyard', 's1', 1)];
    expect(skillMoments(events, 2).map((m) => [m.shipId, m.at, `${m.name}：${m.text}`, m.tone, m.added])).toEqual([
      ['s1', 'die', '好兆頭：重擲，逃過沉沒', 'gain', 0],
      ['s2', 'die', '巨浪：再加 3', 'gain', 3],
      ['s3', 'outcome', '加注：成功 +450 G', 'gain', 0],
      ['s4', 'outcome', '加注：失敗', 'loss', 0],
      [null, 'market', '拾荒：撈到 1 箱 +150 G', 'gain', 0],
    ]);
    expect(skillMoments(events, 3)).toEqual([]);
    expect(skillMoments([fx('reroll', 's1')], 2)[0]!.text).toBe('重擲');
  });

  it.each([1, 2, 3, 4])('plays a die skill as its own cue, the die showing the roll before it (seed %i)', (seed) => {
    const seats: SeatConfig[] = (['aggressive', 'balanced', 'builder', 'balanced'] as const).map((strategy, i) => ({ kind: 'bot', name: `B${i}`, strategy }));
    const setup = setupFromSeats({ seed, seats, rules: RULES_V08 });
    const events = runMatchSync(setup, setup.bots).events as MatchEvent[];
    for (const e of events) {
      if (e.type !== 'ship-resolved') continue;
      const beat = buildShipBeat(events, e.shipId)!;
      const cues = beatCues(beat);
      const kinds = cues.map((c) => c.kind);
      const dieSkills = beat.skills.filter((s) => s.at === 'die');
      expect(kinds.filter((k) => k === 'skill')).toHaveLength(dieSkills.length);
      for (const s of beat.skills) expect(s.shipId).toBe(beat.shipId);
      if (dieSkills.length === 0) continue;
      expect(kinds.indexOf('start')).toBeLessThan(kinds.indexOf('skill'));
      const added = dieSkills.reduce((n, s) => n + s.added, 0);
      const beforeSkill = beatView(beat, cues, kinds.indexOf('skill'));
      const afterSkill = beatView(beat, cues, kinds.indexOf('skill') + dieSkills.length);
      expect(beforeSkill.skillsShown).toBe(0);
      expect(beforeSkill.die).toBe(beat.start - added);
      expect(afterSkill.skillsShown).toBe(dieSkills.length);
      expect(afterSkill.die).toBe(beat.start);
    }
  });
});
