import { PLAYER_ISLAND_HEIGHT, TARGET_ISLAND_HEIGHT, playerIslandHeading } from './islandShape';
import { PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatPosition } from './layout';
import type { IslandDisc } from './seaWave';
import type { ScenePoint } from './stormMath';

/** Top of an island's grass plateau above its cliff height (see `IslandBase`). */
const PLATEAU_TOP = 0.45;
/** Lantern posts stand this far out from the island's center, toward its dock, well inside the grass. */
const POST_REACH = 0.55;

/**
 * Where the night lantern posts stand, on the grass: one on each guild island on its dock side
 * (facing the target island), then one toward each of the target island's four small docks.
 * Mirrors the docks placed in `Islands`.
 */
export function lanternSpots(seatAngles: readonly number[]): ScenePoint[] {
  const guild = seatAngles.map((angle): ScenePoint => {
    const [x, , z] = seatPosition(angle);
    const heading = playerIslandHeading(angle);
    const reach = PLAYER_ISLAND_RADIUS * POST_REACH;
    // The dock sits at +z in island space; turn it by the island's heading.
    return [x + Math.sin(heading) * reach, PLAYER_ISLAND_HEIGHT + PLATEAU_TOP, z + Math.cos(heading) * reach];
  });
  const target = [0, 1, 2, 3].map((i): ScenePoint => {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const reach = TARGET_ISLAND_RADIUS * POST_REACH;
    return [Math.cos(a) * reach, TARGET_ISLAND_HEIGHT + PLATEAU_TOP, Math.sin(a) * reach];
  });
  return [...guild, ...target];
}

/** Plankton glows over this half-extent of sea around the table. */
export const PLANKTON_AREA = { x: 110, z: 85 } as const;
const PLANKTON = 420;

export interface Plankton {
  readonly x: number;
  readonly z: number;
  readonly size: number;
  /** Phase of its slow twinkle. */
  readonly phase: number;
}

/** Plankton gathers in drifting swarms this wide, so it reads as life in the water, not as stars. */
const SWARM_RADIUS = 7;
const PER_SWARM = 14;

/** Glowing plankton in swarms over the open sea, clear of the islands. */
export function planktonField(avoid: readonly IslandDisc[], random: () => number): Plankton[] {
  const field: Plankton[] = [];
  let swarm = { x: 0, z: 0 };
  while (field.length < PLANKTON) {
    if (field.length % PER_SWARM === 0) {
      swarm = { x: (random() * 2 - 1) * PLANKTON_AREA.x, z: (random() * 2 - 1) * PLANKTON_AREA.z };
    }
    // Denser toward the middle of the swarm.
    const a = random() * Math.PI * 2;
    const r = SWARM_RADIUS * random() * random();
    const x = Math.max(-PLANKTON_AREA.x, Math.min(PLANKTON_AREA.x, swarm.x + Math.cos(a) * r));
    const z = Math.max(-PLANKTON_AREA.z, Math.min(PLANKTON_AREA.z, swarm.z + Math.sin(a) * r * 0.7));
    if (avoid.some((d) => Math.hypot(x - d.x, z - d.z) <= d.r)) {
      // Swarm drifted onto an island: start a fresh one elsewhere.
      swarm = { x: (random() * 2 - 1) * PLANKTON_AREA.x, z: (random() * 2 - 1) * PLANKTON_AREA.z };
      continue;
    }
    field.push({ x, z, size: 0.25 + random() * 0.3, phase: random() * Math.PI * 2 });
  }
  return field;
}
