import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import type { SafeArea } from '../../ui/scene/CameraRig';
import { playerIslandHeading } from '../../ui/scene/islandShape';
import { seatPosition } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';

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

/** How wide (scene units) the shot has to show: the ship with its sails, or the warehouse and the ship together. */
const SPAN: Readonly<Record<ShipShot, number>> = { ship: 11, cargo: 18 };

const RIGS: Readonly<Record<ShipShot, Rig>> = {
  ship: { across: 13.5, along: -6, height: 4.2, aim: 1.6, mix: 0 },
  cargo: { across: 19, along: -8, height: 10, aim: 0.5, mix: 0.4 },
};
const FOV = 40;
/** How fast the camera glides to the next rig (per second, exponential). */
const GLIDE = 3;
/** The share of the screen's height the HUD leaves free that the rigs are set for; with less room the camera backs off so the ship still fits. */
const DESIGN_ROOM = 0.55;

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
 * HUD leaves: the picture is shifted so the ship sits in the middle of it, not behind the cards.
 */
export function ShipSideCamera({ angle, shot, safe }: { readonly angle: number; readonly shot: ShipShot; readonly safe?: SafeArea }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  const at = useRef<Rig | null>(null);
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
    // Back off when the HUD leaves little height, and on a narrow (portrait) screen where the span would not fit across.
    const room = safe ? Math.max(0.25, (height - safe.top - safe.bottom) / height) : DESIGN_ROOM;
    const freeWidth = safe ? Math.max(0.3, (width - safe.left - safe.right) / width) : 1;
    const reach = Math.hypot(to.across, to.along, to.height - to.aim);
    const seen = 2 * Math.tan((FOV * Math.PI) / 360) * reach * (width / height) * freeWidth;
    const back = Math.min(2.6, Math.max(0.85, DESIGN_ROOM / room, SPAN[shot] / seen));
    const [ix, , iz] = seatPosition(angle);
    // Across the ship, on the side away from the island.
    const side = (ix - dock.position.x) * Math.cos(dock.heading) - (iz - dock.position.z) * Math.sin(dock.heading) > 0 ? -1 : 1;
    const ax = dock.position.x + (house.x - dock.position.x) * next.mix;
    const az = dock.position.z + (house.z - dock.position.z) * next.mix;
    camera.position.set(
      ax + side * Math.cos(dock.heading) * next.across * back + Math.sin(dock.heading) * next.along * back,
      next.height * back,
      az - side * Math.sin(dock.heading) * next.across * back + Math.cos(dock.heading) * next.along * back,
    );
    camera.lookAt(ax, next.aim, az);
    if (camera.fov !== FOV) {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
    }
    // Moving the middle of the picture to the middle of the free room: a view offset of (x, y) pushes the picture by (−x, −y).
    const x = safe ? (safe.right - safe.left) / 2 : 0;
    const y = safe ? (safe.bottom - safe.top) / 2 : 0;
    if (camera.view?.offsetX !== x || camera.view?.offsetY !== y || camera.view?.fullWidth !== width || camera.view?.fullHeight !== height) {
      camera.setViewOffset(width, height, x, y, width, height);
    }
  });
  return null;
}
