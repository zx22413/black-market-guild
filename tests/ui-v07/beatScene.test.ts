import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../src/v07/match';
import { beatCues, beatView } from '../../src/ui-v07/beats/beatTimeline';
import { buildShipBeat, type ShipBeat } from '../../src/ui-v07/beats/shipBeat';
import { actorsShown, beatSeats, framingOf, involved, stepHit } from '../../src/ui-v07/scene/beatStage';
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
  const withPirate = all.find((b) => b.steps.some((s) => s.kind === 'pirate'))!;

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

  it('fires the cannon on a pirate step and stops reacting once the outcome is out', () => {
    const cues = beatCues(withPirate);
    const firstStepCue = cues.findIndex((c) => c.kind === 'step');
    const pirateStep = withPirate.steps.findIndex((s) => s.kind === 'pirate');
    expect(stepHit(withPirate, viewAfter(withPirate, firstStepCue + pirateStep + 1), null)?.kind).toBe('cannon');
    expect(stepHit(withPirate, viewAfter(withPirate, cues.findIndex((c) => c.kind === 'outcome') + 1), null)).toBeNull();
  });

  it('lets the weather act on its own step: lightning in a storm, a push in a tailwind', () => {
    const fake = (delta: number): ShipBeat => ({ ...withPirate, steps: [{ kind: 'event', delta, value: withPirate.start + delta, actors: [], source: null }] });
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

  it('closes in further on one ship than on the whole table', () => {
    const camera = new PerspectiveCamera(38, width / height);
    const ship = frame(camera, around([-30, 0, 2], 24), width, height, safe);
    const table = frame(camera, around([0, 0, 0], 60), width, height, safe);
    expect(ship.distance).toBeLessThan(table.distance);
  });
});
