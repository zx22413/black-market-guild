import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { beatCues, beatView } from '../../src/ui-v07/beats/beatTimeline';
import { buildShipBeat, type ShipBeat } from '../../src/ui-v07/beats/shipBeat';
import { SHIP_KEEP, actorsShown, beatSeats, framingOf, involved, keptOffset, stepActors, stepHit } from '../../src/ui-v07/scene/beatStage';
import { around, frame } from '../../src/ui-v07/scene/focusMath';

const seats: SeatConfig[] = ['A', 'B', 'C', 'D'].map((name) => ({ kind: 'bot', name, strategy: 'aggressive' }));

function beats(seed: number): ShipBeat[] {
  const setup = setupFromSeats({ seed, seats });
  const events = runMatchSync(setup, setup.bots).events as MatchEvent[];
  return events.flatMap((e) => (e.type === 'ship-resolved' ? [buildShipBeat(events, e.shipId)!] : []));
}

const viewAfter = (beat: ShipBeat, started: number) => beatView(beat, beatCues(beat), started);

describe('ship beat on the 3D table', () => {
  const all = [1, 2, 3, 7].flatMap(beats);
  const withPirate = all.find((b) => b.steps.some((s) => s.kind === 'pirate' && s.boosted.length === 0))!;

  it('brings in each pirate and guard with its own step, and keeps them', () => {
    expect(withPirate).toBeDefined();
    const cues = beatCues(withPirate);
    const pirateStep = withPirate.steps.findIndex((s) => s.kind === 'pirate');
    const firstStepCue = cues.findIndex((c) => c.kind === 'step');
    const before = viewAfter(withPirate, firstStepCue + pirateStep);
    const after = viewAfter(withPirate, firstStepCue + pirateStep + 1);
    expect(actorsShown(withPirate, before).filter((a) => a.role === 'pirate')).toEqual([]);
    expect(actorsShown(withPirate, after).filter((a) => a.role === 'pirate').map((a) => a.playerId)).toEqual(withPirate.steps[pirateStep]!.actors);
    expect(actorsShown(withPirate, viewAfter(withPirate, cues.length)).length).toBeGreaterThanOrEqual(withPirate.steps[pirateStep]!.actors.length);
  });

  it('rams the ship on a pirate step and stops reacting once the outcome is out', () => {
    const cues = beatCues(withPirate);
    const firstStepCue = cues.findIndex((c) => c.kind === 'step');
    const pirateStep = withPirate.steps.findIndex((s) => s.kind === 'pirate');
    expect(stepHit(withPirate, viewAfter(withPirate, firstStepCue + pirateStep + 1), null)?.kind).toBe('ram');
    expect(stepHit(withPirate, viewAfter(withPirate, cues.findIndex((c) => c.kind === 'outcome') + 1), null)).toBeNull();
  });

  it('shields the ship on a guard step, and only the boats of the step on screen strike', () => {
    const guarded: ShipBeat = {
      ...withPirate,
      steps: [
        { kind: 'pirate', delta: -1, value: withPirate.start - 1, actors: ['p3'], source: null, boosted: [] },
        { kind: 'guard', delta: 1, value: withPirate.start, actors: ['p2', 'p4'], source: null, boosted: [] },
      ],
    };
    const first = beatCues(guarded).findIndex((c) => c.kind === 'step');
    const onPirate = viewAfter(guarded, first + 1);
    const onGuard = viewAfter(guarded, first + 2);
    expect(stepHit(guarded, onPirate, null)?.kind).toBe('ram');
    expect(stepActors(guarded, onPirate).map((a) => `${a.role}:${a.playerId}`)).toEqual(['pirate:p3']);
    expect(stepHit(guarded, onGuard, null)?.kind).toBe('shield');
    expect(stepActors(guarded, onGuard).map((a) => `${a.role}:${a.playerId}`)).toEqual(['guard:p2', 'guard:p4']);
    // Both boats stay beside the ship, but only the guards strike during their step.
    expect(actorsShown(guarded, onGuard)).toHaveLength(3);
    // Nobody strikes before the first step or once the outcome is out.
    expect(stepActors(guarded, viewAfter(guarded, first))).toEqual([]);
    expect(stepActors(guarded, viewAfter(guarded, beatCues(guarded).findIndex((c) => c.kind === 'outcome') + 1))).toEqual([]);
  });

  it('lets the weather act on its own step: lightning in a storm, a push in a tailwind', () => {
    const fake = (delta: number): ShipBeat => ({ ...withPirate, steps: [{ kind: 'event', delta, value: withPirate.start + delta, actors: [], source: null, boosted: [] }] });
    const oneStep = (beat: ShipBeat) => viewAfter(beat, beatCues(beat).findIndex((c) => c.kind === 'step') + 1);
    expect(stepHit(fake(-1), oneStep(fake(-1)), 'storm')?.kind).toBe('lightning');
    expect(stepHit(fake(1), oneStep(fake(1)), 'tailwind')?.kind).toBe('push');
    expect(stepHit(fake(1), oneStep(fake(1)), 'sea-fog')?.kind).toBe('lift');
    expect(stepHit(fake(-1), oneStep(fake(-1)), 'moonless-night')?.kind).toBe('jolt');
  });

  it('closes in on the ship from its start die until the beat is over', () => {
    const cues = beatCues(withPirate);
    expect(framingOf(viewAfter(withPirate, 1))).toBe('overview');
    expect(framingOf(viewAfter(withPirate, 2))).toBe('ship');
    expect(framingOf(viewAfter(withPirate, cues.length))).toBe('overview');
  });

  it('marks the owner and every pirate and guard as involved', () => {
    const who = involved(withPirate);
    expect(who.has(withPirate.owner)).toBe(true);
    for (const step of withPirate.steps) if (step.kind === 'pirate' || step.kind === 'guard') for (const id of step.actors) expect(who.has(id)).toBe(true);
  });

  it('seats the viewer first and keeps each color tied to the match seat', () => {
    const players = ['p1', 'p2', 'p3', 'p4'].map((id) => ({ id, name: id }));
    const fromP1 = beatSeats(players, 'p1', {});
    const fromP3 = beatSeats(players, 'p3', { p3: ['shipyard'] });
    expect(fromP3.map((s) => s.id)).toEqual(['p3', 'p4', 'p1', 'p2']);
    expect(fromP3[0]).toMatchObject({ isViewer: true, buildings: ['shipyard'] });
    for (const seat of fromP3) expect(seat.color).toBe(fromP1.find((s) => s.id === seat.id)!.color);
  });
});

describe('focus camera framing', () => {
  const width = 1440;
  const height = 900;
  const safe = { top: 64, bottom: 24, left: 24, right: 380 };

  it.each([
    ['a ship on the left lane', [-30, 0, 2] as const],
    ['a ship near the camera', [3, 0, 25] as const],
    ['a ship far away on the right', [30, 0, -10] as const],
  ])('fits %s, centered in the space left of the panel', (_, center) => {
    const camera = new PerspectiveCamera(38, width / height);
    const points = around(center, 24);
    frame(camera, points, width, height, safe);
    const xs: number[] = [];
    const ys: number[] = [];
    for (const { position } of points) {
      const p = new Vector3(...position).project(camera);
      xs.push(((p.x + 1) / 2) * width);
      ys.push(((1 - p.y) / 2) * height);
    }
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(safe.left - 1);
    expect(Math.max(...xs)).toBeLessThanOrEqual(width - safe.right + 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(safe.top - 1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(height - safe.bottom + 1);
    // Centered: the ship sits within a few pixels of the middle of the free area.
    const c = new Vector3(...center).project(camera);
    expect(Math.abs(((c.x + 1) / 2) * width - (safe.left + width - safe.right) / 2)).toBeLessThan(12);
  });

  it('keeps a close-up when a tall label leaves little room on a short screen', () => {
    // 1025×785 with the market strip on two rows: the ship's tag asks for 300 px above it.
    const short = { w: 1025, h: 785, safe: { top: 152, bottom: 107, left: 24, right: 24 } };
    const camera = new PerspectiveCamera(38, short.w / short.h);
    const ring = around([-30, 0, 2], 15);
    const bare = frame(camera, ring, short.w, short.h, short.safe);
    const tagged = frame(camera, [...ring, { position: [-30, 8, 0] as const, clearance: 300 }], short.w, short.h, short.safe);
    expect(tagged.distance).toBeLessThan(bare.distance * 2); // it was 12× before the cap
  });

  it('closes in further on one ship than on the whole table', () => {
    const camera = new PerspectiveCamera(38, width / height);
    const ship = frame(camera, around([-30, 0, 2], 24), width, height, safe);
    const table = frame(camera, around([0, 0, 0], 60), width, height, safe);
    expect(ship.distance).toBeLessThan(table.distance);
  });
});

describe('the ship keeps what it gains', () => {
  const base = beats(1)[0]!;
  const steps = (kinds: ('guard' | 'event' | 'pirate' | 'island')[], delta = 1): ShipBeat => ({
    ...base,
    steps: kinds.map((kind) => ({ kind, delta: kind === 'pirate' ? -1 : delta, value: base.start, actors: [], source: null, boosted: [] })),
  });

  it('carries a tailwind push forward and keeps it through later steps', () => {
    const beat = steps(['event', 'pirate']);
    expect(keptOffset(beat, 0, 'tailwind').forward).toBe(0);
    expect(keptOffset(beat, 1, 'tailwind').forward).toBe(SHIP_KEEP.push);
    expect(keptOffset(beat, 2, 'tailwind').forward).toBe(SHIP_KEEP.push);
  });

  it('raises the ship a little more with each bit of help, up to a cap, and never drops it on a ram', () => {
    const beat = steps(['guard', 'island', 'pirate', 'event', 'event', 'event']);
    expect(keptOffset(beat, 1, null).up).toBe(SHIP_KEEP.lift);
    expect(keptOffset(beat, 2, null).up).toBe(SHIP_KEEP.lift * 2);
    expect(keptOffset(beat, 3, null).up).toBe(SHIP_KEEP.lift * 2);
    expect(keptOffset(beat, 6, null).up).toBe(SHIP_KEEP.maxLift);
    // A storm or a plain setback does not lift it.
    expect(keptOffset(steps(['event'], -1), 1, null).up).toBe(0);
  });
});
