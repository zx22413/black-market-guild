import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { GOODS, type BuildingId, type GoodId, type Goods } from '../../v07/game';
import { Building } from '../../ui/scene/buildings/Building';
import { playerIslandHeading } from '../../ui/scene/islandShape';
import { ASSET_BUILDING_SCALE, ASSET_LOTS, seatPosition, type Vec3 } from '../../ui/scene/layout';
import { shipPose } from '../../ui/scene/Ships';
import type { ShipState } from '../../ui/scene/tableModel';
import { CRATE_SIZE, CrateModel, GOOD_COLORS } from './CrateModel';
import { ISLAND_PLATEAU } from './TableCanvas';

// The investment decision played on your own island (docs/ui/v07-event-presentation.md §1.3):
// the warehouse is a stack of crates per good, a click loads one onto the ship at the dock and a
// click on the ship unloads it; the chosen building stands as a translucent preview on its lot.

export { GOOD_COLORS };
const CRATE = CRATE_SIZE;
const COLUMN_GAP = 2.4;
/** Warehouse spot in island space: on the dock side, close to the ship it loads onto. */
const WAREHOUSE: Vec3 = [-3.6, 0, 5.8];
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

function Crate({
  good,
  position,
  state,
  glow = false,
  onClick,
}: {
  readonly good: GoodId;
  readonly position: Vec3;
  readonly state: 'normal' | 'used' | 'tarp';
  readonly glow?: boolean;
  readonly onClick?: () => void;
}) {
  const click = onClick
    ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick();
      }
    : undefined;
  return (
    <>
      <group position={position} {...(click ? { onClick: click, onPointerOver: setCursor('pointer'), onPointerOut: setCursor('') } : {})}>
        <CrateModel good={good} tarp={state === 'tarp'} faded={state === 'used'} glow={glow} />
      </group>
      {/* From the table camera a building in front can hide a crate behind it (the warehouse sits
          on the dock side of the lots): a faint see-through copy keeps every stack readable. It is
          never hit by the pointer, so clicks still go to the real crate. */}
      {state !== 'used' && (
        <mesh position={position} renderOrder={10} raycast={() => null}>
          <boxGeometry args={[CRATE, CRATE, CRATE]} />
          <meshBasicMaterial color={state === 'tarp' ? '#8a6a45' : GOOD_COLORS[good]} transparent opacity={0.45} depthTest={false} depthWrite={false} />
        </mesh>
      )}
    </>
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
  /** Nothing loaded yet: the crates that can go on board breathe gold. */
  readonly glow?: boolean;
}

/** One stack of crates per good on the island; the top free crate loads onto the ship. */
export function Warehouse({ angle, stock, forBuild, onShip, canLoad, onLoad, glow = false }: WarehouseProps) {
  return (
    <group position={seatPosition(angle)} rotation={[0, playerIslandHeading(angle), 0]}>
      <group position={[0, ISLAND_PLATEAU, 0]}>
        {GOODS.map((good, column) => {
          const [x, , z] = warehouseLocal(column);
          const free = stock[good] - forBuild[good] - onShip[good];
          return Array.from({ length: stock[good] - onShip[good] }, (_, k) => {
            const used = k < forBuild[good];
            const top = k === forBuild[good] + free - 1;
            const loadable = !used && canLoad(good);
            return (
              <Crate
                key={`${good}-${k}`}
                good={good}
                position={[x, CRATE / 2 + k * (CRATE + 0.05), z]}
                state={used ? 'used' : 'normal'}
                glow={glow && loadable}
                {...(loadable && top ? { onClick: () => onLoad(good) } : {})}
              />
            );
          });
        })}
      </group>
    </group>
  );
}

/** World position of cargo slot `i` of `count` on the ship docked in lane `angle`. */
export function deckSlot(angle: number, i: number, count: number, state: ShipState = 'docked'): Vec3 {
  const pose = shipPose(angle, state);
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
  /** Where the ship is: at the dock while deciding, out at sea once the voyage event is out. */
  readonly state?: ShipState;
}

/** Crates on the deck of the docked ship, with empty slot frames while there is room. */
export function ShipCargo({ angle, load, capacity, onUnload, covered = false, state = 'docked' }: ShipCargoProps) {
  const crates = GOODS.flatMap((g) => Array.from({ length: load[g] }, () => g));
  const slots = covered ? crates.length : capacity;
  return (
    <group>
      {Array.from({ length: slots }, (_, i) => {
        const at = deckSlot(angle, i, slots, state);
        const good = crates[i];
        if (good !== undefined) {
          return <Crate key={i} good={good} position={at} state={covered ? 'tarp' : 'normal'} {...(onUnload ? { onClick: () => onUnload(good) } : {})} />;
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
