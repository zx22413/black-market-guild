import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import type { SafeArea } from '../../ui/scene/CameraRig';
import { playerIslandHeading } from '../../ui/scene/islandShape';
import { seatPosition } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import type { ShipTypeId } from '../../v07/game';

// The ship-bay experiment's two shots of your own docked ship (docs/proposals/2026-11-ship-bays.md): a
// close-up from the open sea while you pick the ship, and a wider one that takes in the warehouse
// while you load it. The camera glides between them. It looks across the ship from the side away from
// the island, so the island and its warehouse stand behind it.

export type ShipShot = 'ship' | 'cargo';

/** Where the camera stands relative to the docked ship; `mix` slides the aim from the ship (0) toward the warehouse (1). */
interface Rig {
  readonly across: number;
  readonly along: number;
  readonly height: number;
  readonly aim: number;
  readonly mix: number;
}

const RIGS: Readonly<Record<ShipShot, Rig>> = {
  ship: { across: 13.5, along: -6, height: 4.2, aim: 1.6, mix: 0 },
  cargo: { across: 19, along: -8, height: 10, aim: 0.5, mix: 0.4 },
};
const FOV = 40;
/** How fast the camera glides to the next rig (per second, exponential). */
const GLIDE = 3;
/** What the camera keeps in view fills this much of the room the HUD leaves free (the rest is air around it). */
const FILL = 0.94;
/**
 * How much taller than the free room the shot may be, as a share of that room: the pick shot is top-aligned under the
 * HUD and its hull goes behind the ship hand, so the mast and sails stay in view while the ship comes out bigger.
 */
const OVERLAP: Readonly<Record<ShipShot, number>> = { ship: 0.1, cargo: 0 };
/** The closest the camera may stand, as a share of the rig's own distance: the loading shot keeps the tuned distance (the ship stays left of the standings), the pick shot may come as close as the room allows. */
const MIN_BACK: Readonly<Record<ShipShot, number>> = { ship: 0.5, cargo: 1 };
/** The gap (px) between the HUD above and the top of the ship in the pick shot. */
const TOP_MARGIN = 8;
/** The ship's box in scene units (half length along the hull, half width, mast height, depth under the water line): what has to fit. */
const SHIP_BOX = { halfLength: 3.4, halfWidth: 1, height: 5.6, depth: 0.5 } as const;
/**
 * Ships taller than the box: 孤注號's lateen tops out near 7.0 and its pennant near 7.3 (the user chose the big sail
 * and a taller frame for this one ship, 2026-11-07), so the pick shot frames it from further back.
 */
const SHIP_TOPS: Partial<Readonly<Record<ShipTypeId, number>>> = { gambler: 7.4 };
/** The warehouse part kept in the loading shot: its two middle columns (half the row's width, a stack's height). */
const WAREHOUSE_REACH = { halfWidth: 2.4, height: 4 } as const;

/** The warehouse's middle in island space (InvestIsland's WAREHOUSE spot, the second column's centre). */
const WAREHOUSE_MIDDLE = 5.8;

/** Centre of the four warehouse stacks in world space. */
export function warehouseCentre(angle: number): { readonly x: number; readonly z: number } {
  const [sx, , sz] = seatPosition(angle);
  const h = playerIslandHeading(angle);
  return { x: sx + WAREHOUSE_MIDDLE * Math.sin(h), z: sz + WAREHOUSE_MIDDLE * Math.cos(h) };
}

/**
 * Looks at the ship docked at island `angle`, gliding to the rig of the current shot. `safe` is the room the
 * HUD leaves: the picture is shifted so the ship sits in the middle of it, not behind the cards. `ship` is the type
 * on show, for the few ships taller than the shared box (`SHIP_TOPS`).
 */
export function ShipSideCamera({ angle, shot, safe, ship }: { readonly angle: number; readonly shot: ShipShot; readonly safe?: SafeArea; readonly ship?: ShipTypeId }) {
  const top = (ship && SHIP_TOPS[ship]) ?? SHIP_BOX.height;
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  const at = useRef<Rig | null>(null);
  const backAt = useRef<number | null>(null);
  // A stand-in camera to measure how big the ship comes out on screen before the real one is placed.
  const probe = useMemo(() => new PerspectiveCamera(FOV, 1, 0.1, 500), []);
  const point = useMemo(() => new Vector3(), []);
  // The camera is shared with the framing camera: hand it back as it was.
  useEffect(() => () => camera.clearViewOffset(), [camera]);
  useFrame((_, delta) => {
    const to = RIGS[shot];
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * GLIDE);
    const now = (at.current ??= to);
    const next: Rig = {
      across: now.across + (to.across - now.across) * k,
      along: now.along + (to.along - now.along) * k,
      height: now.height + (to.height - now.height) * k,
      aim: now.aim + (to.aim - now.aim) * k,
      mix: now.mix + (to.mix - now.mix) * k,
    };
    at.current = next;
    const dock = shipPose(angle, 'docked');
    const house = warehouseCentre(angle);
    const [ix, , iz] = seatPosition(angle);
    // Across the ship, on the side away from the island.
    const side = (ix - dock.position.x) * Math.cos(dock.heading) - (iz - dock.position.z) * Math.sin(dock.heading) > 0 ? -1 : 1;
    const ax = dock.position.x + (house.x - dock.position.x) * next.mix;
    const az = dock.position.z + (house.z - dock.position.z) * next.mix;
    const place = (cam: PerspectiveCamera, back: number) => {
      cam.position.set(
        ax + side * Math.cos(dock.heading) * next.across * back + Math.sin(dock.heading) * next.along * back,
        next.height * back,
        az - side * Math.sin(dock.heading) * next.across * back + Math.cos(dock.heading) * next.along * back,
      );
      cam.lookAt(ax, next.aim, az);
      cam.updateMatrixWorld();
    };

    // How far back the camera has to stand for what must be seen to fill the free room: measured at the rig's own distance
    // (size on screen falls with distance), so a short screen, a narrow one and a tall hand all get the biggest ship that fits.
    probe.aspect = width / height;
    probe.updateProjectionMatrix();
    place(probe, 1);
    const [fx, fz] = [Math.sin(dock.heading), Math.cos(dock.heading)];
    const [px, pz] = [Math.cos(dock.heading), -Math.sin(dock.heading)];
    const corners: [number, number, number][] = [];
    for (const along of [-SHIP_BOX.halfLength, SHIP_BOX.halfLength]) {
      for (const across of [-SHIP_BOX.halfWidth, SHIP_BOX.halfWidth]) {
        for (const up of [-SHIP_BOX.depth, top]) corners.push([dock.position.x + fx * along + px * across, up, dock.position.z + fz * along + pz * across]);
      }
    }
    if (shot === 'cargo') {
      // The row of stacks runs across the island's heading.
      const h = playerIslandHeading(angle);
      for (const along of [-WAREHOUSE_REACH.halfWidth, WAREHOUSE_REACH.halfWidth]) {
        for (const up of [0, WAREHOUSE_REACH.height]) corners.push([house.x + Math.cos(h) * along, up, house.z - Math.sin(h) * along]);
      }
    }
    let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const c of corners) {
      point.set(...c).project(probe);
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    const freeWidth = Math.max(0.2 * width, width - (safe?.left ?? 0) - (safe?.right ?? 0));
    const freeHeight = Math.max(0.2 * height, height - (safe?.top ?? 0) - (safe?.bottom ?? 0));
    const needed = Math.max(((maxX - minX) / 2) * width / (freeWidth * FILL), ((maxY - minY) / 2) * height / (freeHeight * (1 + OVERLAP[shot]) * FILL));
    const target = Math.min(2.8, Math.max(MIN_BACK[shot], needed));
    const back = (backAt.current = backAt.current === null ? target : backAt.current + (target - backAt.current) * k);

    place(camera, back);
    // Where the ship's top comes out on screen at this distance (the pick shot puts it just under the HUD).
    place(probe, back);
    let topPx = Infinity;
    for (const c of corners) topPx = Math.min(topPx, ((1 - point.set(...c).project(probe).y) / 2) * height);
    if (camera.fov !== FOV) {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
    }
    // Moving the middle of the picture to the middle of the free room: a view offset of (x, y) pushes the picture by (−x, −y).
    const x = safe ? (safe.right - safe.left) / 2 : 0;
    const y = !safe ? 0 : shot === 'ship' ? topPx - (safe.top + TOP_MARGIN) : (safe.bottom - safe.top) / 2;
    if (camera.view?.offsetX !== x || camera.view?.offsetY !== y || camera.view?.fullWidth !== width || camera.view?.fullHeight !== height) {
      camera.setViewOffset(width, height, x, y, width, height);
    }
  });
  return null;
}
