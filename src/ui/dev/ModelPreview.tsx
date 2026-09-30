import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { Vector3 } from 'three';
import { ASSET_IDS, type AssetId } from '../../game';
import { PlayerIsland } from '../scene/Islands';
import { Building } from '../scene/buildings/Building';
import { BUILDING_DESIGNS } from '../scene/buildings/designs';
import { bounds } from '../scene/buildings/polyhedra';
import { PLAYER_ISLAND_RADIUS, headingOf, seatPosition, type Vec3 } from '../scene/layout';

/**
 * Dev-only model viewer (`npm run dev`, then `/?dev=models`). Query parameters:
 * - `assets`: comma-separated asset ids (default: all four)
 * - `mode`: `island` (default) shows them on a guild island, `solo` shows the first one alone
 * - `view`: `dock` (default, the side facing the target island), `back`, `far` or `top`
 * - `color`: owner color for the pennants (default red)
 */
type View = 'dock' | 'back' | 'far' | 'top';

/** Camera directions, with +z pointing away from the dock. */
const DIRECTIONS: Record<View, Vec3> = {
  dock: [0.52, 0.64, -0.75],
  back: [0.52, 0.64, 0.75],
  far: [0.52, 0.64, -0.75],
  top: [0, 1, -0.001],
};
const DISTANCE: Record<View, number> = { dock: 1, back: 1, far: 2.2, top: 1.2 };

function parse(search: string): { assets: AssetId[]; solo: boolean; view: View; color: string } {
  const q = new URLSearchParams(search);
  const asked = (q.get('assets') ?? '').split(',').filter((a): a is AssetId => (ASSET_IDS as readonly string[]).includes(a));
  const view = q.get('view');
  return {
    assets: asked.length > 0 ? asked : [...ASSET_IDS],
    solo: q.get('mode') === 'solo',
    view: view === 'back' || view === 'far' || view === 'top' ? view : 'dock',
    color: q.get('color') ?? '#e0584a',
  };
}

/** A guild island moved to the origin, dock toward -z. */
function IslandAtOrigin({ assets, color }: { readonly assets: readonly AssetId[]; readonly color: string }) {
  const angle = Math.PI / 2;
  const home = seatPosition(angle);
  return (
    <group position={[-home[0], 0, -home[2]]}>
      <PlayerIsland seat={{ assets, color }} angle={angle} seed={3} />
    </group>
  );
}

export function ModelPreview() {
  const { assets, solo, view, color } = parse(window.location.search);
  const first = assets[0]!;
  // Frame the island by its radius, a lone building by its bounding box.
  const { min, max } = bounds(BUILDING_DESIGNS[first].parts);
  const reach = solo ? Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 2 : PLAYER_ISLAND_RADIUS * 3.4;
  const focus: Vec3 = solo ? [0, max[1] * 0.4, 0] : [0, 3, 0];
  const position = new Vector3(...DIRECTIONS[view]).normalize().multiplyScalar(reach * DISTANCE[view]).add(new Vector3(...focus));
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#9fd4e0' }}>
      <Canvas shadows camera={{ position: position.toArray(), fov: 40 }} onCreated={({ camera }) => camera.lookAt(...focus)}>
        <color attach="background" args={['#9fd4e0']} />
        <ambientLight intensity={0.9} />
        <hemisphereLight args={['#cfe8ff', '#3a6b4a', 0.6]} />
        <directionalLight position={[-40, 60, 30]} intensity={2.4} color="#fff3d6" castShadow shadow-mapSize={[2048, 2048]} />
        <Suspense fallback={null}>
          {solo ? (
            <group rotation={[0, headingOf(new Vector3(0, 0, -1)), 0]}>
              <mesh position={[0, -0.1, 0]} receiveShadow>
                <boxGeometry args={[3.2, 0.2, 3.2]} />
                <meshStandardMaterial color="#79b35a" />
              </mesh>
              <Building asset={first} color={color} />
            </group>
          ) : (
            <IslandAtOrigin assets={assets} color={color} />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
