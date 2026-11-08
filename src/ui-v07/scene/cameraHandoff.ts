import type { PerspectiveCamera } from 'three';

// The hand-over between the table's two camera rigs: the framing camera over the whole table (FocusCamera) and the
// close-up of your own docked ship (ShipSideCamera). Each rig records where it stood every frame; the rig that takes
// over reads the last record and, for its first moments, flies from there to its own shot instead of cutting: a dive
// from the god's-eye view down to the sea beside the ship, and a climb back out when the ship is done.

export type Vec3 = readonly [number, number, number];

/** Where a camera stands and what it looks at, with its field of view and its view offset (px). */
export interface CameraPose {
  readonly position: Vec3;
  readonly aim: Vec3;
  readonly fov: number;
  readonly offset: readonly [number, number];
}

/** Which rig recorded a pose: a rig flies in only from the other one. */
export type RigName = 'table' | 'ship';

/** A pose older than this (ms) is from an earlier screen, not the rig just let go: the new rig cuts. */
export const HANDOFF_FRESH_MS = 500;
/**
 * Dev only: `?slowmo=N` plays the dive and the climb N times slower, camera and 2D alike, to check them frame by frame.
 * Always 1 in a build.
 */
export const SLOWMO: number = (() => {
  if (!import.meta.env.DEV || typeof location === 'undefined') return 1;
  const n = Number(new URLSearchParams(location.search).get('slowmo'));
  return Number.isFinite(n) && n >= 1 ? n : 1;
})();
/** The dive from the table down to the ship (ms). */
export const DIVE_MS = 1100 * SLOWMO;
/** The climb from the ship back to the table (ms). */
export const CLIMB_MS = 1000 * SLOWMO;

interface Record {
  readonly rig: RigName;
  readonly cameraId: string;
  readonly at: number;
  readonly pose: CameraPose;
}

let last: Record | null = null;

/** Called by a rig every frame, after it placed the camera. */
export function recordPose(rig: RigName, camera: PerspectiveCamera, pose: CameraPose, now: number = performance.now()): void {
  last = { rig, cameraId: camera.uuid, at: now, pose };
}

/** The pose `from` left the same camera in a moment ago, or null (another rig, another canvas, or too long ago). */
export function takePose(from: RigName, camera: PerspectiveCamera, now: number = performance.now()): CameraPose | null {
  const r = last;
  if (!r || r.rig !== from || r.cameraId !== camera.uuid || now - r.at > HANDOFF_FRESH_MS) return null;
  return r.pose;
}

/** Forgets the last record (tests). */
export function clearHandoff(): void {
  last = null;
}

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
export const easeInOutCubic = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/**
 * The flight from `from` to `to` at `t` (0..1). Across the table the camera eases in and out; its height lags when it
 * goes down (it crosses the islands high and drops to the sea at the end, so it never cuts through a hill) and leads
 * when it goes up (it lifts off the water first). The aim turns a little ahead of the camera, so what it is flying to
 * is in the middle of the picture well before it gets there.
 */
export function blendPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  const x = clamp01(t);
  const across = easeInOutCubic(x);
  const down = to.position[1] < from.position[1];
  const up = down ? easeInOutCubic(x ** 1.6) : easeInOutCubic(1 - (1 - x) ** 1.6);
  const aim = easeInOutSine(Math.min(1, x * 1.25));
  return {
    position: [mix(from.position[0], to.position[0], across), mix(from.position[1], to.position[1], up), mix(from.position[2], to.position[2], across)],
    aim: mix3(from.aim, to.aim, aim),
    fov: mix(from.fov, to.fov, across),
    offset: [mix(from.offset[0], to.offset[0], across), mix(from.offset[1], to.offset[1], across)],
  };
}

/** Puts the camera at `pose` on a canvas of `width`×`height` px. */
export function applyPose(camera: PerspectiveCamera, pose: CameraPose, width: number, height: number): void {
  camera.position.set(...pose.position);
  camera.lookAt(...pose.aim);
  if (camera.fov !== pose.fov) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
  const [ox, oy] = pose.offset;
  if (ox === 0 && oy === 0) camera.clearViewOffset();
  else camera.setViewOffset(width, height, ox, oy, width, height);
  camera.updateMatrixWorld();
}

/** The camera's current view offset (px), or none. */
export function viewOffsetOf(camera: PerspectiveCamera): readonly [number, number] {
  return camera.view?.enabled ? [camera.view.offsetX, camera.view.offsetY] : [0, 0];
}

// Whether a flight is on, for the DOM around the canvas: the table's labels, the hand and the bar stay out of the
// picture while the camera moves (shipArrival.css `html.camera-flying`), and a step waits for it to end before it
// deals its cards (useStepArrival).
let flights = 0;
const flightListeners = new Set<() => void>();
/** The class on the root while a flight is on. */
export const FLYING_CLASS = 'camera-flying';

function setFlights(n: number): void {
  flights = Math.max(0, n);
  if (typeof document !== 'undefined') document.documentElement.classList.toggle(FLYING_CLASS, flights > 0);
  flightListeners.forEach((fn) => fn());
}

/** Whether the camera is flying between the two rigs right now. */
export function isFlying(): boolean {
  return flights > 0;
}

/** The flight in progress, if any (the newest when two overlap). */
let current: Flight | null = null;

/**
 * How far the flight in progress has come (ms of its own clock), or null when none is on. The 2D half of the dive (the
 * wave, WaveWipe) runs on this clock, so it stays with the camera even when a frame stalls.
 */
export function flightElapsed(): number | null {
  return current?.elapsedMs ?? null;
}

/** Calls `fn` whenever a flight starts or ends; returns the unsubscribe. */
export function subscribeFlight(fn: () => void): () => void {
  flightListeners.add(fn);
  return () => flightListeners.delete(fn);
}

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The most a single frame advances a flight (ms): a frame that stalls (a model or shader appearing) pauses the flight instead of eating it. */
export const MAX_FLIGHT_STEP_MS = 40;

/**
 * A flight in progress inside a rig: started from the other rig's last pose when there is a fresh one (and motion is
 * welcome), it runs for `duration` ms of its own clock, which advances with each frame but never more than
 * `MAX_FLIGHT_STEP_MS` at once, so a stalled frame never skips the flight; any tap or key ends it at once.
 */
export class Flight {
  private elapsed = 0;
  private skipped = false;
  private live = true;
  private readonly onSkip = (): void => {
    this.skipped = true;
  };

  private constructor(
    private readonly from: CameraPose,
    private readonly duration: number,
  ) {
    window.addEventListener('pointerdown', this.onSkip, { passive: true });
    window.addEventListener('keydown', this.onSkip);
    current = this;
    (globalThis as unknown as { __fl?: unknown[] }).__fl?.push(['start', duration, Math.round(performance.now())]);
    setFlights(flights + 1);
  }

  /** How far it has come (ms of its own clock). */
  get elapsedMs(): number {
    return this.elapsed;
  }

  static start(from: RigName, camera: PerspectiveCamera, duration: number): Flight | null {
    if (reducedMotion()) return null;
    const pose = takePose(from, camera);
    return pose ? new Flight(pose, duration) : null;
  }

  /** The pose for this frame on the way to `to`, or null once the flight is over (the rig then places the camera itself). */
  step(to: CameraPose, delta: number): CameraPose | null {
    this.elapsed = this.skipped ? this.duration : this.elapsed + Math.min(delta * 1000, MAX_FLIGHT_STEP_MS);
    const t = this.elapsed / this.duration;
    if (t >= 1) {
      this.stop();
      return null;
    }
    return blendPose(this.from, to, t);
  }

  stop(): void {
    if (!this.live) return;
    this.live = false;
    window.removeEventListener('pointerdown', this.onSkip);
    window.removeEventListener('keydown', this.onSkip);
    if (current === this) current = null;
    (globalThis as unknown as { __fl?: unknown[] }).__fl?.push(['stop', Math.round(this.elapsed), this.skipped, Math.round(performance.now()), new Error().stack?.split('\n').slice(2, 5).join(' | ')]);
    setFlights(flights - 1);
  }
}
