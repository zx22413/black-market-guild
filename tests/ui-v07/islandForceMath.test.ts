import { describe, expect, it } from 'vitest';
import type { IslandId, MatchEvent, PlayerId } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { BEAT_PACE, beatCues, beatView } from '../../src/ui-v07/beats/beatTimeline';
import { buildShipBeat, type ShipBeat } from '../../src/ui-v07/beats/shipBeat';
import { stepHit } from '../../src/ui-v07/scene/beatStage';
import { BARRAGE, RAID, RAIDERS, SHOTS, barrageCue, landsAt, raidCue, raiderPose, raiderSpot, shotPose, flareSpot } from '../../src/ui-v07/scene/islandForceMath';
import { PLAYER_ISLAND_RADIUS, seatAngles, seatPosition } from '../../src/ui/scene/layout';

const seats: SeatConfig[] = ['A', 'B', 'C', 'D'].map((name) => ({ kind: 'bot', name, strategy: 'aggressive' }));
const angles = seatAngles(4);
const players = ['p1', 'p2', 'p3', 'p4'];
const laneOf = (id: PlayerId) => players.indexOf(id);
const islands: Record<string, IslandId> = { p1: 'pirate-cove', p2: 'fortress', p3: 'mine', p4: 'free-port' };
const lookup = { angleOf: (id: PlayerId) => angles[laneOf(id)]!, islandOf: (id: PlayerId) => islands[id] ?? null };

function allBeats(): { beats: ShipBeat[]; islandsOf: Record<string, IslandId> }[] {
  return Array.from({ length: 40 }, (_, i) => {
    const setup = setupFromSeats({ seed: i + 1, seats });
    const events = runMatchSync(setup, setup.bots).events as MatchEvent[];
    const chosen = events.find((e) => e.type === 'islands-chosen');
    return {
      beats: events.flatMap((e) => (e.type === 'ship-resolved' ? [buildShipBeat(events, e.shipId)!] : [])),
      islandsOf: chosen?.type === 'islands-chosen' ? chosen.islands : {},
    };
  });
}

describe('islands at work in a ship beat', () => {
  const played = allBeats();

  it('marks exactly the cove pirates and fortress guards as boosted', () => {
    let seen = 0;
    for (const { beats, islandsOf } of played) {
      for (const step of beats.flatMap((b) => b.steps)) {
        const expected = step.kind === 'pirate' ? 'pirate-cove' : step.kind === 'guard' ? 'fortress' : null;
        expect(step.boosted).toEqual(step.actors.filter((id) => islandsOf[id] === expected));
        seen += step.boosted.length;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  const base = played[0]!.beats[0]!;
  const beat: ShipBeat = {
    ...base,
    owner: 'p3',
    steps: [
      { kind: 'guard', delta: 2, value: base.start + 2, actors: ['p2'], source: null, boosted: ['p2'] },
      { kind: 'pirate', delta: -2, value: base.start, actors: ['p1'], source: null, boosted: ['p1'] },
      { kind: 'guard', delta: 1, value: base.start + 1, actors: ['p4'], source: null, boosted: [] },
    ],
  };
  const first = beatCues(beat).findIndex((c) => c.kind === 'step');
  const at = (step: number) => beatView(beat, beatCues(beat), first + step + 1);

  it('raids and fires only on the boosted steps, and gives them time to play out', () => {
    expect(barrageCue(beat, at(0), lookup)).not.toBeNull();
    expect(raidCue(beat, at(0), lookup)).toBeNull();
    expect(raidCue(beat, at(1), lookup)).not.toBeNull();
    expect(barrageCue(beat, at(2), lookup)).toBeNull();
    expect(stepHit(beat, at(0), null)?.kind).toBe('bastion');
    expect(stepHit(beat, at(1), null)?.kind).toBe('raid');
    expect(stepHit(beat, at(2), null)?.kind).toBe('shield');
    const cues = beatCues(beat, 2.5);
    const s = cues.findIndex((c) => c.kind === 'step');
    expect(cues[s + 1]!.at - cues[s]!.at).toBe(BEAT_PACE.island);
    expect(cues[s + 3]!.at - cues[s + 2]!.at).toBeLessThan(BEAT_PACE.island);
  });

  it('sends the raiders round the island on open water, to their spots by the ship before the ram', () => {
    const raid = raidCue(beat, at(1), lookup)!;
    const center = seatPosition(angles[0]!);
    for (const p of raid.path.slice(0, -1)) expect(Math.hypot(p[0] - center[0], p[2] - center[2])).toBeGreaterThan(PLAYER_ISLAND_RADIUS + 2);
    for (let i = 0; i < RAIDERS; i++) {
      expect(raiderPose(raid, i, -0.01).out).toBe(false);
      const end = raiderPose(raid, i, RAID.arrive).at;
      raiderSpot(raid, i).forEach((v, j) => expect(end[j]).toBeCloseTo(v));
    }
    expect(RAID.arrive).toBeLessThan(RAID.ram);
  });

  it('arcs every flare from the fort to rest on the shield, up off the water, before the golden shield', () => {
    const barrage = barrageCue(beat, at(0), lookup)!;
    for (let i = 0; i < SHOTS; i++) {
      expect(shotPose(barrage, i, 0)).toBeNull();
      const mid = shotPose(barrage, i, landsAt(i) - BARRAGE.flight / 2)!;
      expect(mid[1]).toBeGreaterThan(barrage.fort[1] / 2);
      const end = shotPose(barrage, i, landsAt(i) - 1e-6)!;
      flareSpot(barrage, i).forEach((v, j) => expect(end[j]).toBeCloseTo(v, 3));
      // Never down at the waterline round the ship: a salute, not shots at it.
      expect(flareSpot(barrage, i)[1]).toBeGreaterThan(3);
      expect(shotPose(barrage, i, landsAt(i) + 0.01)).toBeNull();
    }
    expect(landsAt(SHOTS - 1)).toBeLessThanOrEqual(BARRAGE.shield);
  });
});
