import { describe, expect, it } from 'vitest';
import type { IslandId, MatchEvent, PlayerId } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { BEAT_PACE, DIE_HOLD, beatCues, beatView } from '../../src/ui-v07/beats/beatTimeline';
import { buildShipBeat, type ShipBeat } from '../../src/ui-v07/beats/shipBeat';
import { beaconAt } from '../../src/ui-v07/scene/islandScenery';
import { DARKNESS, PEEK_PACE, SPOTLIGHT_HOLD, SPOT_TIME, lampPoint, peekSpotlight, revealSpotlight, spotlightFrame, voyageSpotlight } from '../../src/ui-v07/scene/spotlightMath';
import { seatAngles } from '../../src/ui/scene/layout';

const seats: SeatConfig[] = ['A', 'B', 'C', 'D'].map((name) => ({ kind: 'bot', name, strategy: 'aggressive' }));
const angles = seatAngles(4);
const players = ['p1', 'p2', 'p3', 'p4'];
const laneOf = (id: PlayerId) => players.indexOf(id);
const islands: Record<string, IslandId> = { p1: 'lighthouse', p2: 'fortress', p3: 'mine', p4: 'free-port' };
const lookup = { angleOf: (id: PlayerId) => angles[laneOf(id)]!, islandOf: (id: PlayerId) => islands[id] ?? null };

function someBeat(): ShipBeat {
  const setup = setupFromSeats({ seed: 3, seats });
  const events = runMatchSync(setup, setup.bots).events as MatchEvent[];
  const shipId = events.flatMap((e) => (e.type === 'ship-resolved' ? [e.shipId] : []))[0]!;
  return buildShipBeat(events, shipId)!;
}

describe('lighthouse spotlight', () => {
  const base = someBeat();
  const lit: ShipBeat = {
    ...base,
    steps: [
      { kind: 'pirate', delta: -1, value: base.start - 1, actors: ['p2'], source: null },
      { kind: 'island', delta: 1, value: base.start, actors: [], source: 'lighthouse' },
    ],
  };
  const first = beatCues(lit).findIndex((c) => c.kind === 'step');
  const at = (started: number) => beatView(lit, beatCues(lit), started);

  it('only the lighthouse has a beacon lamp, up on its tower above the plateau', () => {
    expect(beaconAt('lighthouse', 0)).not.toBeNull();
    expect(beaconAt('fortress', 0)).toBeNull();
    expect(beaconAt(null, 0)).toBeNull();
    const lamp = lampPoint('lighthouse', angles[0]!)!;
    expect(lamp[1]).toBeGreaterThan(10);
  });

  it('shines on the ship during the island step only', () => {
    expect(voyageSpotlight(lit, at(first + 1), lookup)).toBeNull();
    const cue = voyageSpotlight(lit, at(first + 2), lookup)!;
    expect(cue.targets).toHaveLength(1);
    expect(cue.settle).toBeNull();
    expect(cue.hold).toBe(SPOTLIGHT_HOLD.voyage);
    expect(voyageSpotlight(lit, at(beatCues(lit).findIndex((c) => c.kind === 'outcome') + 1), lookup)).toBeNull();
  });

  it('gives the island step time for the beam, even on a fast-forwarded ship', () => {
    const cues = beatCues(lit, 2.5);
    const island = cues.findIndex((c) => c.kind === 'step' && lit.steps[c.index]?.kind === 'island');
    expect(cues[island + 1]!.at - cues[island]!.at).toBe(BEAT_PACE.island);
    expect(cues[island]!.at - cues[island - 1]!.at).toBe(DIE_HOLD);
  });

  it('shines on the start die of a ship the lighthouse intel rerolled, from that merchant\'s lamp, for long enough', () => {
    const changed: ShipBeat = { ...lit, owner: 'p3', rerolled: true, rerollSpotter: 'p1', steps: [] };
    const onStart = beatView(changed, beatCues(changed), beatCues(changed).findIndex((c) => c.kind === 'start') + 1);
    const cue = voyageSpotlight(changed, onStart, lookup)!;
    expect(cue.lamp).toEqual(lampPoint('lighthouse', angles[0]!));
    const cues = beatCues(changed, 2.5);
    const start = cues.findIndex((c) => c.kind === 'start');
    expect(cues[start + 1]!.at - cues[start]!.at).toBe(BEAT_PACE.island);
    // Without the lighthouse's reroll the start die stays unlit.
    expect(voyageSpotlight({ ...changed, rerollSpotter: null }, onStart, lookup)).toBeNull();
  });

  it('lights the private look for the lighthouse only, held until it is taken away', () => {
    const ships = [[10, 0, 0], [-10, 0, 0]] as const;
    expect(peekSpotlight('k', 'fortress', angles[0]!, ships, null)).toBeNull();
    const look = peekSpotlight('k', 'lighthouse', angles[0]!, ships, null)!;
    expect(look.settle).toBeNull();
    expect(spotlightFrame(look, 60).dark).toBeCloseTo(DARKNESS);
    const closing = peekSpotlight('k', 'lighthouse', angles[0]!, ships, 1)!;
    expect(closing.key).not.toBe(look.key);
    // Starts dark and locked, with no second lock flash, and closes onto the rerolled ship.
    const first = spotlightFrame(closing, 0);
    expect(first.dark).toBeCloseTo(DARKNESS);
    expect(first.flare).toBe(0);
    first.beams.forEach((b, i) => b.end.forEach((v, j) => expect(v).toBeCloseTo(ships[i]![j]!)));
    spotlightFrame(closing, PEEK_PACE.close / 1000).beams[0]!.end.forEach((v, j) => expect(v).toBeCloseTo(ships[1]![j]!));
  });

  describe('at the role reveal', () => {
    const reveal = (rerolled: string[], island = 'lighthouse'): MatchEvent[] =>
      [
        { type: 'islands-chosen', islands: { p1: island, p2: 'fortress', p3: 'mine', p4: 'free-port' } },
        { type: 'roles-revealed', round: 1, role: 'guard', deployments: [{ playerId: 'p2', role: 'guard', targetShipId: 's2', bet: null, peekShipId: null }], rerolledShipIds: [] },
        { type: 'roles-revealed', round: 1, role: 'intel', deployments: [{ playerId: 'p1', role: 'intel', targetShipId: 's3', bet: null, peekShipId: 's4' }], rerolledShipIds: rerolled },
      ] as unknown as MatchEvent[];
    const owner = (id: string) => ({ s2: 'p2', s3: 'p3', s4: 'p4' })[id];

    it('aims two beams at the two ships the lighthouse intel looked at, in its reveal group', () => {
      const spot = revealSpotlight(reveal([]), 1, angles, laneOf, owner)!;
      expect(spot.group).toBe(1);
      expect(spot.cue.targets).toHaveLength(2);
      expect(spot.cue.settle).toBeNull();
      expect(spot.cue.hold).toBe(SPOTLIGHT_HOLD.reveal);
    });

    it('closes onto the rerolled ship when exactly one of the two was rerolled', () => {
      expect(revealSpotlight(reveal(['s4']), 1, angles, laneOf, owner)!.cue.settle).toBe(1);
      expect(revealSpotlight(reveal(['s3', 's4']), 1, angles, laneOf, owner)!.cue.settle).toBeNull();
    });

    it('stays off for an intel merchant without a beacon island', () => {
      expect(revealSpotlight(reveal([], 'spice-isles'), 1, angles, laneOf, owner)).toBeNull();
    });
  });
});

describe('spotlight timing', () => {
  const cue = { key: 'k', lamp: [0, 12, -30] as const, targets: [[10, 0, 0], [-10, 0, 0]] as const, settle: 1, hold: SPOTLIGHT_HOLD.reveal };

  it('darkens, swings the beams onto their ships, locks with a flash, and lights up again', () => {
    expect(spotlightFrame(cue, 0).dark).toBe(0);
    expect(spotlightFrame(cue, 0.5).beams[0]!.end).not.toEqual(cue.targets[0]);
    const locked = spotlightFrame(cue, SPOT_TIME.lock);
    expect(locked.dark).toBeCloseTo(DARKNESS);
    locked.beams.forEach((b, i) => b.end.forEach((v, j) => expect(v).toBeCloseTo(cue.targets[i]![j]!)));
    expect(locked.flare).toBeCloseTo(1);
    const over = spotlightFrame(cue, cue.hold + SPOT_TIME.fade);
    expect(over.dark).toBe(0);
    expect(over.flare).toBe(0);
  });

  it('closes the other beam onto the settled ship, where it goes out', () => {
    const closed = spotlightFrame(cue, SPOT_TIME.closeTo);
    closed.beams[0]!.end.forEach((v, j) => expect(v).toBeCloseTo(cue.targets[1]![j]!));
    expect(closed.beams[0]!.strength).toBe(0);
    expect(closed.beams[1]!.strength).toBeCloseTo(1);
  });

  it('keeps every beam when there is nothing to close onto', () => {
    const apart = spotlightFrame({ ...cue, settle: null }, SPOT_TIME.closeTo);
    apart.beams.forEach((b, i) => b.end.forEach((v, j) => expect(v).toBeCloseTo(cue.targets[i]![j]!)));
    expect(apart.beams.every((b) => b.strength > 0.9)).toBe(true);
  });
});
