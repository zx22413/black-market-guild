import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { GOODS, type GoodId } from '../../v07/game';
import { playerIslandHeading } from '../../ui/scene/islandShape';
import { PLAYER_ISLAND_RADIUS, seatPosition } from '../../ui/scene/layout';
import { SWEEP, crateFrame } from '../table3d/tideSweepShow';
import { Burst, WaterRing, fan } from './beatFx';
import { CRATE_SIZE, CrateModel } from './CrateModel';
import { warehouseLocal } from './InvestIsland';
import { ISLAND_PLATEAU } from './TableCanvas';

// V0.8 prototype (rules.v08.events, an experiment, not rules): 「暗潮將至」 taking the warehouses' goods, on the table.
// The dark water comes up over each island that lost goods, lifts one crate per unit lost off the warehouse's ground,
// carries them out toward the open sea in the middle of the table and lets them go under one after another, each with
// a ring and spray. How far along each crate is comes from `crateFrame` (table3d/tideSweepShow.ts).

/** How far past the shore a crate is carried before it sinks, and how much further each next crate goes. */
const REACH = { first: 5, step: 1.3, spread: 3.4 } as const;
/** The water over the island at its highest (above the plateau) and how see-through it is then. */
const FLOOD = { over: 0.55, opacity: 0.6, radius: 1.14 } as const;
const SEA_Y = 0.45;
const SINK_DEPTH = 3.4;
/** Bigger than a crate on a deck: the whole table is in the picture while they are carried off. */
const CRATE_SCALE = 1.45;
const SPRAY = fan(10, Math.PI * 2, 3.2, 7, 5);
const FOAM = '#b8fff8';

export interface TideSweepIsland {
  /** The seat's angle on the table. */
  readonly angle: number;
  readonly crates: readonly GoodId[];
}

/** Where crate `i` starts (its good's stack in the warehouse) and where it goes under. */
export function cratePath(angle: number, good: GoodId, i: number): { readonly from: Vector3; readonly to: Vector3 } {
  const [cx, , cz] = seatPosition(angle);
  const heading = playerIslandHeading(angle);
  const [lx, , lz] = warehouseLocal(GOODS.indexOf(good));
  // The warehouse stands in the island's own frame (turned by its heading, as the Warehouse group is).
  const from = new Vector3(cx + lx * Math.cos(heading) + lz * Math.sin(heading), ISLAND_PLATEAU + CRATE_SIZE / 2 + Math.floor(i / GOODS.length) * 0.5, cz - lx * Math.sin(heading) + lz * Math.cos(heading));
  // Out toward the middle of the table, fanned a little so the crates do not go under in one spot.
  const out = new Vector3(-cx, 0, -cz).normalize();
  const side = new Vector3(-out.z, 0, out.x);
  const reach = PLAYER_ISLAND_RADIUS + REACH.first + i * REACH.step;
  const to = new Vector3(cx, SEA_Y, cz).addScaledVector(out, reach).addScaledVector(side, ((i % 3) - 1) * REACH.spread);
  return { from, to };
}

function SweptCrate({ angle, good, index }: { readonly angle: number; readonly good: GoodId; readonly index: number }) {
  const group = useRef<Group>(null);
  const start = useRef<number | null>(null);
  const { from, to } = useMemo(() => cratePath(angle, good, index), [angle, good, index]);
  const sinkAt = SWEEP.surge * 0.6 + index * SWEEP.stagger + SWEEP.drift;
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const f = crateFrame(t, index);
    g.visible = f.visible;
    if (!f.visible) return;
    // It comes down off the island as it goes out, riding a little higher while the water under it is up.
    const down = f.along * f.along * (3 - 2 * f.along);
    const bob = Math.sin(t * 3.4 + index * 1.7) * 0.22 * f.lift;
    g.position.set(from.x + (to.x - from.x) * f.along, from.y + (to.y - from.y) * down + f.lift * FLOOD.over * (1 - f.along) + bob - f.under * SINK_DEPTH, from.z + (to.z - from.z) * f.along);
    g.rotation.set(Math.sin(t * 1.9 + index) * 0.28 * f.lift + f.under * 0.9, f.along * (index % 2 === 0 ? 1.6 : -1.6), Math.cos(t * 1.6 + index * 2.1) * 0.24 * f.lift);
    // Popped in as the water reaches the warehouse.
    g.scale.setScalar(Math.min(1, t / 0.3) * CRATE_SCALE);
  });
  return (
    <>
      <group ref={group} position={from} scale={0}>
        <CrateModel good={good} />
      </group>
      <WaterRing at={to} color={FOAM} delay={sinkAt} from={0.8} to={4.4} length={0.8} />
      <Burst at={to} particles={SPRAY} color={FOAM} size={0.24} delay={sinkAt} length={0.7} gravity={9} height={0.5} />
    </>
  );
}

/** The dark water coming up over an island and going down again, with the wave's rings running out from its shore. */
function Flood({ angle, color, length }: { readonly angle: number; readonly color: string; readonly length: number }) {
  const mesh = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  const [x, , z] = seatPosition(angle);
  const at = useMemo(() => new Vector3(x, 0, z), [x, z]);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    // Up fast with the surge, held while the crates leave, down slowly.
    const up = Math.min(1, t / SWEEP.surge);
    const down = Math.min(1, Math.max(0, t - SWEEP.surge - length * 0.35) / (length * 0.65));
    const level = (1 - (1 - up) ** 3) * (1 - down * down);
    m.visible = level > 0.01;
    m.position.y = 0.3 + level * (ISLAND_PLATEAU + FLOOD.over - 0.3);
    (m.material as MeshBasicMaterial).opacity = FLOOD.opacity * level;
  });
  return (
    <>
      <mesh ref={mesh} position={[x, 0.3, z]} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={3}>
        <circleGeometry args={[PLAYER_ISLAND_RADIUS * FLOOD.radius, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <WaterRing at={at} color={FOAM} delay={0} from={PLAYER_ISLAND_RADIUS * 0.5} to={PLAYER_ISLAND_RADIUS * 1.7} length={SWEEP.surge * 1.4} />
      <WaterRing at={at} color={FOAM} delay={SWEEP.surge * 0.5} from={PLAYER_ISLAND_RADIUS * 0.6} to={PLAYER_ISLAND_RADIUS * 1.9} length={SWEEP.surge * 1.6} />
    </>
  );
}

export function TideSweep({ islands, water }: { readonly islands: readonly TideSweepIsland[]; readonly water: string }) {
  return (
    <>
      {islands.map((island) => (
        <group key={island.angle}>
          <Flood angle={island.angle} color={water} length={island.crates.length * SWEEP.stagger + SWEEP.drift} />
          {island.crates.map((good, i) => (
            <SweptCrate key={i} angle={island.angle} good={good} index={i} />
          ))}
        </group>
      ))}
    </>
  );
}
