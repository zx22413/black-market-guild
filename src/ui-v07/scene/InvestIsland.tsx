import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, MeshBasicMaterial } from 'three';
import { GOODS, type BuildingId, type GoodId, type Goods } from '../../v07/game';
import { Building } from '../../ui/scene/buildings/Building';
import { playerIslandHeading } from '../../ui/scene/islandShape';
import { ASSET_BUILDING_SCALE, ASSET_LOTS, seatPosition, type Vec3 } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import { ISLAND_PLATEAU } from './TableCanvas';

// The investment decision played on your own island (docs/ui/v07-event-presentation.md §1.3):
// the warehouse is a stack of crates per good, a click loads one onto the ship at the dock and a
// click on the ship unloads it; the chosen building stands as a translucent preview on its lot.

export const GOOD_COLORS: Readonly<Record<GoodId, string>> = { wood: '#c08a4e', iron: '#9fb0bd', spice: '#e2823a', arms: '#d35d6e' };
const CRATE = 1.7;
const COLUMN_GAP = 2.6;
/** Warehouse spot in island space: in front of the banner, toward the dock. */
const WAREHOUSE: Vec3 = [-3.9, 0, 3.4];
/** Deck height and slot spacing of the docked ship (ship-medium at scale 0.546). */
const DECK_Y = 1.25;
const SLOT_GAP = 1.75;

export const warehouseLocal = (column: number): Vec3 => [WAREHOUSE[0] + column * COLUMN_GAP, 0, WAREHOUSE[2]];
/** Top of a stack of `count` crates, for its label. */
export const stackTop = (column: number, count: number): Vec3 => {
  const [x, , z] = warehouseLocal(column);
  return [x, Math.max(1, count) * (CRATE + 0.05) + 0.3, z];
};

function setCursor(value: string) {
  return () => {
    document.body.style.cursor = value;
  };
}

function Crate({ color, position, state, onClick }: { readonly color: string; readonly position: Vec3; readonly state: 'normal' | 'used' | 'tarp'; readonly onClick?: () => void }) {
  const click = onClick
    ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick();
      }
    : undefined;
  return (
    <mesh
      position={position}
      castShadow
      {...(click ? { onClick: click, onPointerOver: setCursor('pointer'), onPointerOut: setCursor('') } : {})}
    >
      <boxGeometry args={[CRATE, CRATE, CRATE]} />
      <meshStandardMaterial color={state === 'tarp' ? '#8a6a45' : color} transparent={state === 'used'} opacity={state === 'used' ? 0.28 : 1} flatShading />
    </mesh>
  );
}

export interface WarehouseProps {
  readonly angle: number;
  readonly stock: Goods;
  /** Units the chosen building uses: drawn faded at the bottom of each stack. */
  readonly forBuild: Goods;
  /** Units on the ship: taken off the top of each stack. */
  readonly onShip: Goods;
  readonly canLoad: (good: GoodId) => boolean;
  readonly onLoad: (good: GoodId) => void;
}

/** One stack of crates per good on the island; the top free crate loads onto the ship. */
export function Warehouse({ angle, stock, forBuild, onShip, canLoad, onLoad }: WarehouseProps) {
  return (
    <group position={seatPosition(angle)} rotation={[0, playerIslandHeading(angle), 0]}>
      <group position={[0, ISLAND_PLATEAU, 0]}>
        {GOODS.map((good, column) => {
          const [x, , z] = warehouseLocal(column);
          const free = stock[good] - forBuild[good] - onShip[good];
          return Array.from({ length: stock[good] - onShip[good] }, (_, k) => {
            const used = k < forBuild[good];
            const top = k === forBuild[good] + free - 1;
            return (
              <Crate
                key={`${good}-${k}`}
                color={GOOD_COLORS[good]}
                position={[x, CRATE / 2 + k * (CRATE + 0.05), z]}
                state={used ? 'used' : 'normal'}
                {...(!used && top && canLoad(good) ? { onClick: () => onLoad(good) } : {})}
              />
            );
          });
        })}
      </group>
    </group>
  );
}

/** World position of cargo slot `i` of `count` on the ship docked in lane `angle`. */
export function deckSlot(angle: number, i: number, count: number): Vec3 {
  const pose = shipPose(angle, 'docked');
  const offset = (i - (count - 1) / 2) * SLOT_GAP;
  return [pose.position.x + Math.sin(pose.heading) * offset, DECK_Y + CRATE / 2, pose.position.z + Math.cos(pose.heading) * offset];
}

export interface ShipCargoProps {
  readonly angle: number;
  readonly load: Goods;
  readonly capacity: number;
  /** Unload on click (while deciding); omit once submitted. */
  readonly onUnload?: (good: GoodId) => void;
  /** Hide what is on board: other players' ships show a tarp (§4). */
  readonly covered?: boolean;
}

/** Crates on the deck of the docked ship, with empty slot frames while there is room. */
export function ShipCargo({ angle, load, capacity, onUnload, covered = false }: ShipCargoProps) {
  const crates = GOODS.flatMap((g) => Array.from({ length: load[g] }, () => g));
  const slots = covered ? crates.length : capacity;
  return (
    <group>
      {Array.from({ length: slots }, (_, i) => {
        const at = deckSlot(angle, i, slots);
        const good = crates[i];
        if (good !== undefined) {
          return <Crate key={i} color={GOOD_COLORS[good]} position={at} state={covered ? 'tarp' : 'normal'} {...(onUnload ? { onClick: () => onUnload(good) } : {})} />;
        }
        return (
          <mesh key={i} position={at}>
            <boxGeometry args={[CRATE, CRATE, CRATE]} />
            <meshBasicMaterial color="#fff6d8" wireframe transparent opacity={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

/** The chosen building as a pulsing see-through preview on its lot, until the choice is submitted. */
export function BuildingPreview({ angle, building, color }: { readonly angle: number; readonly building: BuildingId; readonly color: string }) {
  const group = useRef<Group>(null);
  const ring = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (group.current) group.current.position.y = 0.15 + Math.sin(t * 2.4) * 0.12;
    if (ring.current) ring.current.opacity = 0.45 + 0.35 * Math.sin(t * 3);
  });
  const lot = ASSET_LOTS[building];
  return (
    <group position={seatPosition(angle)} rotation={[0, playerIslandHeading(angle), 0]}>
      <group position={[lot[0], ISLAND_PLATEAU + 0.05, lot[2]]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.2, 2.8, 32]} />
          <meshBasicMaterial ref={ring} color="#ffd36b" transparent opacity={0.6} />
        </mesh>
        <group ref={group}>
          <Building asset={building} color={color} scale={ASSET_BUILDING_SCALE} />
        </group>
      </group>
    </group>
  );
}
