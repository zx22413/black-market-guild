// How sharp the 3D table is drawn on a phone. Measured on an iPhone 16 Pro Max in the LINE
// browser: the table is fill-rate bound, 2x ran ~30fps, 1.5x ~40fps and 1x ~54fps, while cutting
// draw calls or the sea's CPU work changed nothing. So a phone starts at 1.5x and steps down when
// frames run long, then tries a sharper level again after a stretch of easy frames (the stretch
// doubles each time the attempt fails, up to 80s); a desktop keeps the default and never goes through here.

/** Pixel ratios a phone may use, sharpest last; none above what the screen has. */
export function phoneDprLevels(deviceDpr: number): readonly number[] {
  const all = [1, 1.25, 1.5];
  const fitting = all.filter((l) => l <= deviceDpr);
  return fitting.length > 0 ? fitting : [1];
}

/** A phone: touch first and a short side of a tablet or less. */
export function isPhone(coarsePointer: boolean, shortSide: number): boolean {
  return coarsePointer && shortSide <= 820;
}

/** Average frame time (ms) above which the picture is too slow: about 45fps. */
export const SLOW_MS = 22;
/** Average frame time (ms) at or below which there is room to be sharper again: about 57fps. */
export const FAST_MS = 17.5;
/** How long one verdict looks at the frames, in ms. */
export const WINDOW_MS = 2000;
/** Good windows in a row before stepping up (10s of headroom), when no step up has had to be undone. */
export const GOOD_WINDOWS = 5;
/** The most good windows ever asked for (80s): a level is never given up on for good. */
export const MAX_GOOD_WINDOWS = 40;

/** Good windows in a row asked for before the next step up: doubles with each step up that had to be undone. */
export const goodWindowsFor = (flips: number): number => Math.min(MAX_GOOD_WINDOWS, GOOD_WINDOWS * 2 ** flips);

export interface DprState {
  readonly level: number;
  readonly good: number;
  /** Steps up that were followed by a step down. */
  readonly flips: number;
  /** Whether the last move was a step up (the next step down then counts as a flip). */
  readonly climbed: boolean;
}

export const startState = (levels: readonly number[]): DprState => ({ level: levels.length - 1, good: 0, flips: 0, climbed: false });

/** One verdict from a window's average frame time: step down when slow, up after enough good windows. */
export function judgeWindow(state: DprState, avgMs: number, levels: readonly number[]): DprState {
  if (avgMs > SLOW_MS) {
    if (state.level === 0) return { ...state, good: 0 };
    return { level: state.level - 1, good: 0, flips: state.climbed ? state.flips + 1 : state.flips, climbed: false };
  }
  if (avgMs <= FAST_MS && state.level < levels.length - 1) {
    const good = state.good + 1;
    return good >= goodWindowsFor(state.flips) ? { ...state, level: state.level + 1, good: 0, climbed: true } : { ...state, good };
  }
  return { ...state, good: 0 };
}
