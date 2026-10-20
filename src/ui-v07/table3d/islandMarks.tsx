import type { PlayerId } from '../../v07/game';
import { ISLAND_PLATEAU, type TablePin } from '../scene/TableCanvas';
import { PLAYER_ISLAND_RADIUS, laneCurve, seatPosition, type Vec3 } from '../../ui/scene/layout';

// Invisible marks around each guild island, tracked over the 3D table like any label. Together
// their screen rectangle frames the island (shore, buildings and dock), so the tutorial's
// highlight can light an island wherever the camera has moved it.

/**
 * Points around the shore (cliffs and annexes reach past the plateau), higher up over the plateau
 * where the buildings stand, and at the dock, where the ship waits with its cargo.
 */
const SHORE = 12;
const SHORE_REACH = 1.45;
const BUILDINGS_HEIGHT = 7;
const SHIP_HEIGHT = 5;

export function islandMarkPoints(angle: number): Vec3[] {
  const [x, , z] = seatPosition(angle);
  const ring = (radius: number, y: number): Vec3[] =>
    Array.from({ length: SHORE }, (_, i) => {
      const a = (i / SHORE) * Math.PI * 2;
      return [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius];
    });
  const dock = laneCurve(angle).getPoint(0);
  return [
    ...ring(PLAYER_ISLAND_RADIUS * SHORE_REACH, 0),
    ...ring(PLAYER_ISLAND_RADIUS * 0.6, ISLAND_PLATEAU + BUILDINGS_HEIGHT),
    [dock.x, 0, dock.z],
    [dock.x, SHIP_HEIGHT, dock.z],
  ];
}

export function islandMarkPins(seats: readonly { readonly id: PlayerId; readonly angle: number }[]): TablePin[] {
  return seats.flatMap(({ id, angle }) =>
    islandMarkPoints(angle).map((position, i) => ({
      id: `mark-${id}-${i}`,
      position,
      node: <i data-focus={`island-${id}`} className="focus-mark" aria-hidden="true" />,
    })),
  );
}
