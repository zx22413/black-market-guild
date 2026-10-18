import type { Vec3 } from '../polyhedra';
import type { P } from './design';

// A mine railway's track and the run of its cars, as pure geometry: shared by the mine's design, the
// table's animation (`Landmark`'s train) and the tests.

/** A point on a train's loop and the way the track runs there (a unit vector). */
export interface TrackPoint {
  readonly at: Vec3;
  readonly toward: Vec3;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);

/** Lengths of a closed loop's legs, the last running back to the first point. */
function legs(path: readonly Vec3[]): number[] {
  return path.map((p, i) => length(sub(path[(i + 1) % path.length]!, p)));
}

/** How far round a closed loop is. */
export function loopLength(path: readonly Vec3[]): number {
  return legs(path).reduce((sum, leg) => sum + leg, 0);
}

/** Where on a closed loop a car `distance` along it from the first point is, wrapping round. */
export function pointAlong(path: readonly Vec3[], distance: number): TrackPoint {
  const lengths = legs(path);
  const total = lengths.reduce((sum, leg) => sum + leg, 0);
  let left = ((distance % total) + total) % total;
  for (let i = 0; i < path.length; i++) {
    const leg = lengths[i]!;
    if (left <= leg || i === path.length - 1) {
      const [from, to] = [path[i]!, path[(i + 1) % path.length]!];
      const [dx, dy, dz] = sub(to, from);
      const n = leg || 1;
      return { at: lerp(from, to, leg > 0 ? Math.min(1, left / leg) : 0), toward: [dx / n, dy / n, dz / n] };
    }
    left -= leg;
  }
  throw new Error('unreachable: a loop always has a last leg');
}

/** Distance along a closed loop to its point `index`. */
export function distanceTo(path: readonly Vec3[], index: number): number {
  return legs(path).slice(0, index).reduce((sum, leg) => sum + leg, 0);
}

/**
 * Where on its loop a train that has run `run` units is, when it runs at its own pace only along
 * `path[shown[0]..shown[1]]`, where it can be seen, and `rush` times faster everywhere else, inside the
 * rock. A car `spacing` behind runs `run - spacing`, so the cars keep their spacing in the open.
 */
export function rushedDistance(path: readonly Vec3[], shown: readonly [number, number], rush: number, run: number): number {
  const [from, to] = [distanceTo(path, shown[0]), distanceTo(path, shown[1])];
  const total = loopLength(path);
  const lap = from / rush + (to - from) + (total - to) / rush;
  const u = ((run % lap) + lap) % lap;
  if (u < from / rush) return u * rush;
  if (u < from / rush + (to - from)) return from + (u - from / rush);
  return to + (u - from / rush - (to - from)) * rush;
}

/** The horizontal unit vector to the right of a track running along `toward`. */
function rightOf(toward: Vec3): Vec3 {
  const flat = Math.hypot(toward[0], toward[2]) || 1;
  return [-toward[2] / flat, 0, toward[0] / flat];
}

/** How big the railway is drawn, relative to the sizes below: the track, tunnel mouths and cars all grow together. */
const RAIL_SIZE = 1.3;

/** Track dimensions, in the design's units: rail gauge, sleepers and the shelf cut into the slope. */
export const TRACK = {
  gauge: 0.105 * RAIL_SIZE,
  rail: 0.015 * RAIL_SIZE,
  sleeper: 0.021 * RAIL_SIZE,
  sleeperLength: 0.165 * RAIL_SIZE,
  shelf: 0.18 * RAIL_SIZE,
} as const;

/**
 * Track laid along the open stretch `path[from..to]` (rail tops on the path): two iron rails, a
 * sleeper at every point and a shelf of earth under them cut into the hillside.
 */
export function trackParts(path: readonly Vec3[], from: number, to: number): P[] {
  const stretch = path.slice(from, to + 1);
  return stretch.slice(0, -1).flatMap((a, i): P[] => {
    const b = stretch[i + 1]!;
    const right = rightOf(sub(b, a));
    const side = (p: Vec3, s: number, drop: number): Vec3 => [p[0] + right[0] * s, p[1] - drop, p[2] + right[2] * s];
    const shelfDrop = TRACK.sleeper + TRACK.shelf / 2;
    return [
      ...[-1, 1].map((s): P => ({ kind: 'beam', from: side(a, (s * TRACK.gauge) / 2, TRACK.rail / 2), to: side(b, (s * TRACK.gauge) / 2, TRACK.rail / 2), width: TRACK.rail, mat: 'metal' })),
      { kind: 'beam', from: side(a, -TRACK.sleeperLength / 2, TRACK.rail + TRACK.sleeper / 2), to: side(a, TRACK.sleeperLength / 2, TRACK.rail + TRACK.sleeper / 2), width: TRACK.sleeper, mat: 'woodDark' },
      { kind: 'beam', from: side(a, 0, shelfDrop), to: side(b, 0, shelfDrop), width: TRACK.shelf, mat: 'stone' },
    ];
  });
}

/**
 * A tunnel mouth on the track at `at`, the tunnel running level along `inward` into the rock: a spur of
 * rock over the tunnel's first stretch, so the cars are out of sight from the mouth on, and on its face
 * a dark opening framed by two timber props and a cap.
 */
export function portalParts(at: Vec3, inward: Vec3): P[] {
  const right = rightOf(inward);
  const k = RAIL_SIZE;
  const point = (back: number, s: number, y: number): Vec3 => [at[0] + inward[0] * back + right[0] * s * k, at[1] + y * k, at[2] + inward[2] * back + right[2] * s * k];
  const [half, height, spur] = [0.12, 0.3, 0.32];
  return [
    { kind: 'beam', from: point(0, 0, spur / 2 - 0.03), to: point(0.45, 0, spur / 2 - 0.03), width: spur * k, mat: 'slate' },
    { kind: 'beam', from: point(-0.012, 0, 0.13), to: point(0.004, 0, 0.13), width: 0.24 * k, mat: 'dark' },
    ...[-1, 1].map((s): P => ({ kind: 'beam', from: point(-0.02, s * half, -0.015), to: point(-0.02, s * half, height - 0.03), width: 0.027 * k, mat: 'woodDark' })),
    { kind: 'beam', from: point(-0.02, -half - 0.03, height - 0.03), to: point(-0.02, half + 0.03, height - 0.03), width: 0.033 * k, mat: 'woodDark' },
  ];
}

/** Parts authored at the origin, grown to the railway's size and moved to `at` (boxes, prisms and beams only). */
function placed(parts: readonly P[], [x, y, z]: Vec3): P[] {
  const k = RAIL_SIZE;
  const move = (p: Vec3): Vec3 => [x + p[0] * k, y + p[1] * k, z + p[2] * k];
  return parts.map((part): P => {
    switch (part.kind) {
      case 'box':
        return { ...part, center: move(part.center), size: [part.size[0] * k, part.size[1] * k, part.size[2] * k], ...(part.bevel ? { bevel: part.bevel * k } : {}) };
      case 'prism':
        return { ...part, base: move(part.base), radius: part.radius * k, height: part.height * k, ...(part.top !== undefined ? { top: part.top * k } : {}) };
      case 'beam':
        return { ...part, from: move(part.from), to: move(part.to), width: part.width * k };
      default:
        throw new Error(`railway parts are boxes, prisms and beams, not ${part.kind}`);
    }
  });
}

/** The top of the engine's chimney, where its smoke leaves: ahead of the engine's middle, and up from the rails. */
export const ENGINE_CHIMNEY = { ahead: 0.105 * RAIL_SIZE, up: 0.263 * RAIL_SIZE } as const;

/** Wheel diameter, and the car's and engine's width. */
const WHEEL = 0.066;
const WIDE = 0.138;

/** A pair of iron wheels on an axle across the track at `x`. */
function wheels(x: number, diameter = WHEEL): P {
  return { kind: 'beam', from: [x, diameter / 2, -WIDE / 2 - 0.006], to: [x, diameter / 2, WIDE / 2 + 0.006], width: diameter, sides: 8, mat: 'metal' };
}

/** One mine car (Agricola's "hund") with its wheels on the rails at `at`, running along +x. */
export function mineCar(at: Vec3): P[] {
  const [len, axle, body] = [0.21, 0.068, 0.098];
  const y = WHEEL / 2 + body / 2;
  return placed(
    [
      { kind: 'box', center: [0, y, 0], size: [len, body, WIDE], bevel: 0.01, mat: 'wood' },
      ...[-1, 1].map((s): P => ({ kind: 'box', center: [s * axle, y, 0], size: [0.016, body + 0.009, WIDE + 0.009], mat: 'metal' })),
      ...[-1, 1].map((s) => wheels(s * axle)),
      { kind: 'prism', base: [0, WHEEL / 2 + body, 0], radius: 0.075, top: 0.024, height: 0.039, sides: 6, mat: 'stone' },
      { kind: 'prism', base: [0.024, WHEEL / 2 + body + 0.012, 0.018], radius: 0.027, top: 0.009, height: 0.03, sides: 5, mat: 'gold' },
      { kind: 'box', center: [len / 2 + 0.018, WHEEL / 2 + 0.015, 0], size: [0.036, 0.015, 0.015], mat: 'metal' },
    ],
    at,
  );
}

/**
 * A little mine engine at the head of the train, running along +x: a saddle-tank engine with a black
 * boiler girdled in brass, a tall flared chimney, a brass dome, a red buffer beam and lamp at the front
 * and a timber cab with an iron roof at the back.
 */
export function mineEngine(at: Vec3): P[] {
  const deck = WHEEL / 2 + 0.03;
  const boilerY = deck + 0.06;
  return placed(
    [
      // Running board, wheels and the red buffer beams.
      { kind: 'box', center: [0, deck - 0.012, 0], size: [0.27, 0.024, WIDE], bevel: 0.004, mat: 'dark' },
      ...[-0.07, 0.06].map((x) => wheels(x, 0.08)),
      ...[-1, 1].map((s): P => ({ kind: 'box', center: [s * 0.14, deck - 0.01, 0], size: [0.018, 0.04, WIDE + 0.02], mat: 'mace' })),
      // Boiler with brass bands and a saddle tank over it.
      { kind: 'beam', from: [-0.04, boilerY, 0], to: [0.13, boilerY, 0], width: 0.1, sides: 8, mat: 'dark' },
      ...[0.01, 0.08].map((x): P => ({ kind: 'beam', from: [x - 0.006, boilerY, 0], to: [x + 0.006, boilerY, 0], width: 0.108, sides: 8, mat: 'brass' })),
      { kind: 'box', center: [0.03, boilerY + 0.035, 0], size: [0.12, 0.05, 0.116], bevel: 0.015, mat: 'mace' },
      // Chimney, flared at the top, and the brass steam dome.
      { kind: 'prism', base: [0.105, boilerY + 0.04, 0], radius: 0.022, top: 0.02, height: 0.07, sides: 8, mat: 'dark' },
      { kind: 'prism', base: [0.105, boilerY + 0.11, 0], radius: 0.02, top: 0.034, height: 0.03, sides: 8, mat: 'dark' },
      { kind: 'prism', base: [0.0, boilerY + 0.06, 0], radius: 0.022, top: 0.012, height: 0.03, sides: 8, mat: 'brass' },
      // Smokebox front and its lamp.
      { kind: 'beam', from: [0.13, boilerY, 0], to: [0.14, boilerY, 0], width: 0.09, sides: 8, mat: 'metal' },
      { kind: 'box', center: [0.142, boilerY + 0.06, 0], size: [0.014, 0.024, 0.024], mat: 'brass' },
      // Cab at the back.
      { kind: 'box', center: [-0.085, deck + 0.065, 0], size: [0.09, 0.13, WIDE], bevel: 0.006, mat: 'woodDark' },
      ...[-1, 1].map((s): P => ({ kind: 'box', center: [-0.085, deck + 0.09, s * (WIDE / 2 + 0.002)], size: [0.05, 0.045, 0.006], mat: 'dark' })),
      { kind: 'box', center: [-0.085, deck + 0.14, 0], size: [0.11, 0.016, WIDE + 0.02], bevel: 0.004, mat: 'metal' },
    ],
    at,
  );
}
