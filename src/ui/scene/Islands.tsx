import type { ThreeEvent } from '@react-three/fiber';
import { IslandBase, type IslandGround } from './IslandBase';
import type { IslandAnnex } from './islandShape';
import { IslandRing } from './IslandRing';
import { useState, type ReactNode } from 'react';
import { BuildSite } from './BuildSite';
import { ASSET_BUILDING_SCALE, ASSET_LOTS, PLAYER_ISLAND_RADIUS, seatAngles, seatPosition } from './layout';
import { MarketIsland, type MarketShow } from './MarketIsland';
import { playerIslandHeading } from './islandShape';
import { Model } from './Model';
import type { SceneSeat } from './tableModel';

const PLATEAU = 2.6;

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
  /** The chosen island's ground colors (default: grass on sand). */
  readonly ground?: IslandGround;
  /** The chosen island's scenery, in plateau space; it replaces the default palms and crates. */
  readonly scenery?: ReactNode;
  /** A lobe of cliff the chosen island's big landmark rises from. */
  readonly annex?: IslandAnnex;
}

/** One guild's home island: dock toward the center, owned assets in fixed lots. */
export function PlayerIsland({ seat, angle, seed, selectable = false, selected = false, onSelect, ground, scenery, annex }: PlayerIslandProps) {
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
      <IslandBase radius={PLAYER_ISLAND_RADIUS} seed={seed} {...(ground ? { ground } : {})} {...(annex ? { annex } : {})} />
      <group position={[0, PLATEAU, 0]}>
        {seat.assets.map((asset) => (
          <BuildSite key={asset} asset={asset} color={seat.color} position={ASSET_LOTS[asset]} scale={ASSET_BUILDING_SCALE} animate={!standing.has(asset)} />
        ))}
        {scenery ?? (
          <>
            <Model name="palm-bend" position={[-3.6, 0, 5.8]} scale={1} rotation={[0, 1.2, 0]} />
            <Model name="palm-straight" position={[5.2, 0, 4.2]} scale={0.9} />
            <Model name="barrel" position={[1.8, 0, 5.6]} scale={0.7} />
            <Model name="crate" position={[-1.2, 0, 6.2]} scale={0.8} />
          </>
        )}
        <Banner color={seat.color} position={[0, 0, 0.5]} />
      </group>
      <Model name="structure-platform-dock" position={[0, 0.2, PLAYER_ISLAND_RADIUS + 0.4]} scale={[1.2, 1, 1.6]} />
      <Model name="rocks-sand-a" position={[-11, -0.6, 5.4]} scale={0.8} />
    </group>
  );
}

/** The market island at the center of the table, where every ship sails to sell (`MarketIsland`). */
export function TargetIsland({ seatAngles: angles = seatAngles(4), show, night = false }: { readonly seatAngles?: readonly number[]; readonly show?: MarketShow; readonly night?: boolean }) {
  return <MarketIsland seatAngles={angles} night={night} {...(show ? { show } : {})} />;
}

