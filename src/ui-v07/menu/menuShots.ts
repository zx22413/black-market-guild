import { MENU_BERTH, orbitPosition } from './menuMotion';
import { laneCurve, seatPosition, type Vec3 } from '../../ui/scene/layout';

// Where the menu's camera stands for each menu page: circling the market on the title screen,
// behind your island for single player, high over every lane for the online pages, at the
// lighthouse for the tutorial, and chasing your ship out to the market when a match starts. The
// camera glides between these stops. Pure, so the shots are testable.

export type MenuStage = 'title' | 'local' | 'online' | 'lobby' | 'tutorial' | 'launch';

export interface Shot {
  readonly position: Vec3;
  readonly target: Vec3;
}

export interface MenuShotContext {
  /** The menu table's seat angles. */
  readonly angles: readonly number[];
  /** Your island (the one in front). */
  readonly yours: number;
  /** The lighthouse island, where the tutorial stops. */
  readonly guide: number;
  /** Seconds since the launch began (only for the launch shot). */
  readonly launchElapsed: number;
}

/** The launch: seconds the ships sail before the match screen takes over (the last `fade` dims to it). */
export const LAUNCH = { sail: 2.6, fade: 0.7 } as const;

/** How long a glide to a new stop takes to settle, in seconds (about). */
const SETTLE = 1.2;

const smooth = (x: number): number => x * x * (3 - 2 * x);
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** How far along the launch the ships are: 0 at their docks, 1 at the market's berths. */
export function launchProgress(elapsed: number): number {
  return smooth(clamp01(elapsed / LAUNCH.sail));
}

/** One frame of a glide from `from` toward `to`: framerate independent, settling in about SETTLE seconds. */
export function glide(from: number, to: number, delta: number): number {
  const k = 1 - Math.exp((-4 * Math.min(delta, 0.1)) / SETTLE);
  return from + (to - from) * k;
}

/**
 * The target moved so it shows right of center by `right` and above center by `up`, both as shares
 * of the camera's ground distance to it (so near and far shots shift alike on screen).
 */
export function aimOff(position: Vec3, target: Vec3, right: number, up: number): Vec3 {
  const dx = target[0] - position[0];
  const dz = target[2] - position[2];
  const length = Math.hypot(dx, dz);
  if (length === 0 || (right === 0 && up === 0)) return target;
  const fx = dx / length;
  const fz = dz / length;
  // Forward is (fx, fz) on the sea and the camera's right is (-fz, fx): look the other way to push the target over.
  return [target[0] + (fz * right - fx * up) * length, target[1], target[2] + (-fx * right - fz * up) * length];
}

/** A close shot of a seat's island from behind it (seen from the open sea), drifting gently. */
function islandShot(angle: number, time: number, back: number, height: number): Shot {
  const [x, , z] = seatPosition(angle);
  const out = Math.hypot(x, z);
  const ox = x / out;
  const oz = z / out;
  const drift = Math.sin(time * 0.25) * 4;
  return {
    position: [x + ox * back - oz * drift, height, z + oz * back + ox * drift],
    // A little toward the market, so the island's dock and its waiting ship are in the frame.
    target: [x - ox * 9, 0, z - oz * 9],
  };
}

/** Lane curves by seat angle, built once: the launch shot reads them every frame. */
const curves = new Map<number, ReturnType<typeof laneCurve>>();
function cachedLane(angle: number): ReturnType<typeof laneCurve> {
  let curve = curves.get(angle);
  if (!curve) {
    curve = laneCurve(angle);
    curves.set(angle, curve);
  }
  return curve;
}

function launchShot(angle: number, elapsed: number): Shot {
  const curve = cachedLane(angle);
  const ship = curve.getPoint(launchProgress(elapsed) * MENU_BERTH);
  const ahead = curve.getPoint(Math.min(1, launchProgress(elapsed) * MENU_BERTH + 0.25));
  const [hx, , hz] = seatPosition(angle);
  const out = Math.hypot(hx, hz);
  return {
    position: [ship.x + (hx / out) * 26, 24, ship.z + (hz / out) * 26],
    target: [ahead.x, 0, ahead.z],
  };
}

export function menuShot(stage: MenuStage, time: number, ctx: MenuShotContext): Shot {
  switch (stage) {
    case 'title':
      return { position: orbitPosition(time), target: [0, 0, 0] };
    case 'local':
      return islandShot(ctx.angles[ctx.yours] ?? 0, time, 50, 54);
    case 'tutorial':
      return islandShot(ctx.angles[ctx.guide] ?? 0, time, 40, 44);
    case 'online':
    case 'lobby':
      return { position: [Math.sin(time * 0.05) * 12, 168, 96], target: [0, 0, 6] };
    case 'launch':
      return launchShot(ctx.angles[ctx.yours] ?? 0, ctx.launchElapsed);
  }
}
