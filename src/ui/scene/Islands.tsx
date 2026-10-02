import type { ThreeEvent } from '@react-three/fiber';
import { IslandBase } from './IslandBase';
import { IslandRing } from './IslandRing';
import { useState } from 'react';
import { BuildSite } from './BuildSite';
import { ASSET_BUILDING_SCALE, ASSET_LOTS, PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, seatPosition } from './layout';
import { TARGET_ISLAND_HEIGHT, TARGET_ISLAND_SEED, playerIslandHeading } from './islandShape';
import { Model } from './Model';
import type { SceneSeat } from './tableModel';

const PLATEAU = 2.6;
/** The target island's props were laid out for a radius of 8 and grow with the island. */
const TARGET_DECOR_SCALE = TARGET_ISLAND_RADIUS / 8;

/** A guild pennant in the player's color. */
function Banner({ color, position }: { readonly color: string; readonly position: readonly [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 4, 6]} />
        <meshStandardMaterial color="#6b4a2b" />
      </mesh>
      <mesh position={[0.75, 3.4, 0]} castShadow>
        <boxGeometry args={[1.5, 0.9, 0.06]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
    </group>
  );
}

interface PlayerIslandProps {
  readonly seat: Pick<SceneSeat, 'assets' | 'color'>;
  readonly angle: number;
  readonly seed: number;
  /** Partner candidate right now: shows a hint ring and can be clicked. */
  readonly selectable?: boolean;
  /** The current (unconfirmed) pick: shown with a bold frame. */
  readonly selected?: boolean;
  readonly onSelect?: () => void;
}

/** One guild's home island: dock toward the center, owned assets in fixed lots. */
export function PlayerIsland({ seat, angle, seed, selectable = false, selected = false, onSelect }: PlayerIslandProps) {
  const home = seatPosition(angle);
  // Buildings already standing when the island appears are simply there; later ones are built on screen.
  const [standing] = useState(() => new Set(seat.assets));
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!selectable) return;
    e.stopPropagation();
    onSelect?.();
  };
  const cursor = (value: string) => () => {
    if (selectable) document.body.style.cursor = value;
  };
  return (
    <group
      position={home}
      rotation={[0, playerIslandHeading(angle), 0]}
      onClick={click}
      onPointerOver={cursor('pointer')}
      onPointerOut={cursor('')}
    >
      {(selectable || selected) && <IslandRing selected={selected} />}
      <IslandBase radius={PLAYER_ISLAND_RADIUS} seed={seed} />
      <group position={[0, PLATEAU, 0]}>
        {seat.assets.map((asset) => (
          <BuildSite key={asset} asset={asset} color={seat.color} position={ASSET_LOTS[asset]} scale={ASSET_BUILDING_SCALE} animate={!standing.has(asset)} />
        ))}
        <Model name="palm-bend" position={[-3.6, 0, 5.8]} scale={1} rotation={[0, 1.2, 0]} />
        <Model name="palm-straight" position={[5.2, 0, 4.2]} scale={0.9} />
        <Model name="barrel" position={[1.8, 0, 5.6]} scale={0.7} />
        <Model name="crate" position={[-1.2, 0, 6.2]} scale={0.8} />
        <Banner color={seat.color} position={[0, 0, 0.5]} />
      </group>
      <Model name="structure-platform-dock" position={[0, 0.2, PLAYER_ISLAND_RADIUS + 0.4]} scale={[1.2, 1, 1.6]} />
      <Model name="rocks-sand-a" position={[-11, -0.6, 5.4]} scale={0.8} />
    </group>
  );
}

/** The destination island at the center of the table. */
export function TargetIsland() {
  return (
    <group>
      <IslandBase radius={TARGET_ISLAND_RADIUS} seed={TARGET_ISLAND_SEED} height={TARGET_ISLAND_HEIGHT} />
      <group position={[0, 3.4, 0]} scale={TARGET_DECOR_SCALE}>
        <Model name="tower-complete-large" position={[0, 0, -1]} scale={0.8} />
        <Model name="castle-wall" position={[-3.2, 0, 0.6]} scale={0.7} rotation={[0, 0.5, 0]} />
        <Model name="castle-wall" position={[3.2, 0, 0.6]} scale={0.7} rotation={[0, -0.5, 0]} />
        <Model name="palm-detailed-bend" position={[-4.6, 0, -2.6]} scale={0.8} />
        <Model name="palm-straight" position={[4.8, 0, -2.2]} scale={0.75} />
        <Model name="chest" position={[1.6, 0, 3]} scale={0.7} />
        <Model name="flag-high" position={[0, 8.2, -1]} scale={0.8} />
      </group>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        return (
          <Model
            key={i}
            name="structure-platform-dock-small"
            position={[Math.cos(a) * (TARGET_ISLAND_RADIUS + 0.6), 0.2, Math.sin(a) * (TARGET_ISLAND_RADIUS + 0.6)]}
            rotation={[0, -a + Math.PI / 2, 0]}
          />
        );
      })}
    </group>
  );
}

