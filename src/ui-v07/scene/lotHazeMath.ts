// The building's close-up: how the table's fog closes in behind the building, so what stands further away than it
// fades into the sky (kept apart from LotHaze.tsx so it can be tested without WebGL).

export interface FogRange {
  readonly near: number;
  readonly far: number;
}

/** The fog begins this far past the building, as a share of the camera's distance to it: the building itself stays clear. */
export const HAZE_NEAR = 1.2;
/** Where the fog is full, as a share of the camera's distance to the building: the other islands are well past it. */
export const HAZE_FAR = 3.2;

/** The fog `t` (0…1) of the way from the weather's own range to the close-up's, for a camera `distance` from the building. */
export function hazeRange(weather: FogRange, distance: number, t: number): FogRange {
  const e = Math.min(1, Math.max(0, t));
  // Never further than the weather's own fog: a close-up only brings it nearer.
  const near = Math.min(weather.near, distance * HAZE_NEAR);
  const far = Math.min(weather.far, distance * HAZE_FAR);
  return { near: weather.near + (near - weather.near) * e, far: weather.far + (far - weather.far) * e };
}
