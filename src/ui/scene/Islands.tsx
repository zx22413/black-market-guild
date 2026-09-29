import { IslandBase } from './IslandBase';
import { ASSET_BUILDINGS, PLAYER_ISLAND_RADIUS, TARGET_ISLAND_RADIUS, headingOf, seatPosition } from './layout';
import { Vector3 } from 'three';
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
}

/** One guild's home island: dock toward the center, owned assets in fixed lots. */
export function PlayerIsland({ seat, angle, seed }: PlayerIslandProps) {
  const home = seatPosition(angle);
  return (
    <group position={home} rotation={[0, headingOf(new Vector3(-home[0], 0, -home[2])), 0]}>
      <IslandBase radius={PLAYER_ISLAND_RADIUS} seed={seed} />
      <group position={[0, PLATEAU, 0]}>
        {seat.assets.map((asset) => {
          const { model, lot, scale } = ASSET_BUILDINGS[asset];
          return <Model key={asset} name={model} position={lot} scale={scale} />;
        })}
        <Model name="palm-bend" position={[-4.2, 0, 2.2]} scale={0.8} rotation={[0, 1.2, 0]} />
        <Model name="palm-straight" position={[4.4, 0, 1.6]} scale={0.7} />
        <Model name="barrel" position={[1.2, 0, 3.4]} scale={0.5} />
        <Model name="crate" position={[-1.4, 0, 3.6]} scale={0.6} />
        <Banner color={seat.color} position={[0, 0, 0.5]} />
      </group>
      <Model name="structure-platform-dock" position={[0, 0.2, PLAYER_ISLAND_RADIUS + 0.4]} scale={[1.2, 1, 1.6]} />
      <Model name="rocks-sand-a" position={[-6, -0.6, 3]} scale={0.5} />
    </group>
  );
}

/** The destination island at the center of the table. */
export function TargetIsland() {
  return (
    <group>
      <IslandBase radius={TARGET_ISLAND_RADIUS} seed={99} height={3.2} />
      <group position={[0, 3.4, 0]}>
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

