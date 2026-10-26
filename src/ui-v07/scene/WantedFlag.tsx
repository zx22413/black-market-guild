import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { useSoundOnce } from '../audio/useUiSounds';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import type { Vec3 } from '../../ui/scene/layout';
import { islandPoint } from './TableCanvas';

// The red flag planted on a wanted player's island (§9.6) just before the voyage event is
// announced. Low-poly and flat-shaded like the rest of the table: a stone mound, a wooden pole
// with a gold finial and a swallow-tailed red cloth that ripples. It drops from the sky, lands
// with a little squash and a ring of dust, then the cloth unfurls.

const POLE_HEIGHT = 7.5;
const CLOTH_WIDTH = 4.2;
const CLOTH_HEIGHT = 2.6;
const NOTCH = 1.1;
const COLUMNS = 5;
const DROP_FROM = 16;
const DROP_SECONDS = 0.55;
const UNFURL_SECONDS = 0.45;
const RING_SECONDS = 0.9;
/** Where it stands on the island (island space, +z toward the dock): the middle, clear of the lots and the warehouse. */
const SPOT: Vec3 = [0.4, 0, -0.9];

/** The table camera (src/ui-v07/scene/TableCanvas.tsx) and how far the near island is from it. */
const CAMERA: Vec3 = [0, 82, 60];
const NEAR_DISTANCE = 86;
const BASE_SIZE = 1.5;

const CLOTH_TOP = new Color('#ef5a48');
const CLOTH_BOTTOM = new Color('#a3261e');

type Point = readonly [number, number];

/** The cloth's triangles (x along the arm, y up): a strip of quads, then the forked tail. */
function clothTriangles(): Point[] {
  const end = CLOTH_WIDTH - NOTCH;
  const mid = CLOTH_HEIGHT / 2;
  const points: Point[] = [];
  for (let k = 0; k < COLUMNS; k++) {
    const x0 = (end * k) / COLUMNS;
    const x1 = (end * (k + 1)) / COLUMNS;
    points.push([x0, CLOTH_HEIGHT], [x0, 0], [x1, CLOTH_HEIGHT], [x1, CLOTH_HEIGHT], [x0, 0], [x1, 0]);
  }
  points.push([end, CLOTH_HEIGHT], [end, mid], [CLOTH_WIDTH, CLOTH_HEIGHT], [end, mid], [end, 0], [CLOTH_WIDTH, 0]);
  return points;
}

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

function Cloth({ landedAt }: { readonly landedAt: { current: number | null } }) {
  const group = useRef<Group>(null);
  const { geometry, base } = useMemo(() => {
    const points = clothTriangles();
    const base = new Float32Array(points.flatMap(([x, y]) => [x, y]));
    const colors = new Float32Array(
      points.flatMap(([, y]) => {
        const c = CLOTH_BOTTOM.clone().lerp(CLOTH_TOP, y / CLOTH_HEIGHT);
        return [c.r, c.g, c.b];
      }),
    );
    // Not indexed, so every triangle keeps its own flat normal.
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(points.length * 3), 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    return { geometry, base };
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const since = landedAt.current === null ? 0 : t - landedAt.current;
    g.scale.x = 0.05 + 0.95 * easeOut(Math.min(1, since / UNFURL_SECONDS));
    const position = geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < base.length / 2; i++) {
      const x = base[i * 2]!;
      // The far end ripples most; the edge at the pole stays still.
      position.setXYZ(i, x, base[i * 2 + 1]!, Math.sin(t * 4.5 - x * 1.7) * 0.32 * (x / CLOTH_WIDTH));
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return (
    <group ref={group} position={[0.14, POLE_HEIGHT - CLOTH_HEIGHT - 0.35, 0]}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial vertexColors flatShading side={DoubleSide} roughness={0.8} />
      </mesh>
    </group>
  );
}

export function WantedFlag({ angle }: { readonly angle: number }) {
  const [x, y, z] = useMemo(() => islandPoint(angle, SPOT), [angle]);
  // Far islands look smaller from the table camera: grow the flag with the distance so it reads the same everywhere.
  const size = useMemo(() => (BASE_SIZE * Math.hypot(CAMERA[1], CAMERA[2] - z, x - CAMERA[0])) / NEAR_DISTANCE, [x, z]);
  const drop = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const born = useRef<number | null>(null);
  // The flag unfurls with a rustle of cloth.
  useSoundOnce('wanted');
  const landedAt = useRef<number | null>(null);

  useFrame(({ clock }) => {
    born.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - born.current;
    const g = drop.current;
    if (g) {
      if (t < DROP_SECONDS) {
        const p = t / DROP_SECONDS;
        g.position.y = DROP_FROM * (1 - p * p);
        g.scale.set(1, 1, 1);
      } else {
        landedAt.current ??= clock.elapsedTime;
        // A short squash and spring back on landing.
        const s = t - DROP_SECONDS;
        g.position.y = 0;
        g.scale.set(1 + Math.max(0, 0.1 * Math.sin(s * 22) * Math.exp(-s * 7)), 1 - Math.max(0, 0.12 * Math.sin(s * 22) * Math.exp(-s * 7)), 1);
      }
    }
    const r = ring.current;
    if (r) {
      const s = t - DROP_SECONDS;
      r.visible = s >= 0 && s < RING_SECONDS;
      if (r.visible) {
        const k = s / RING_SECONDS;
        r.scale.setScalar(0.6 + 4.4 * easeOut(k));
        (r.material as MeshBasicMaterial).opacity = 0.7 * (1 - k);
      }
    }
  });

  return (
    <group position={[x, y, z]} scale={size}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} visible={false}>
        <ringGeometry args={[0.9, 1.25, 7]} />
        <meshBasicMaterial color="#f3e7c9" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <group ref={drop} position={[0, DROP_FROM, 0]}>
        {/* Stone mound and two rocks. */}
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.75, 1.35, 0.7, 7]} />
          <meshStandardMaterial color="#9a9482" flatShading roughness={0.95} />
        </mesh>
        <mesh position={[1.25, 0.2, 0.5]} rotation={[0.2, 0.7, 0.1]} castShadow>
          <boxGeometry args={[0.55, 0.4, 0.5]} />
          <meshStandardMaterial color="#847e6e" flatShading roughness={0.95} />
        </mesh>
        <mesh position={[-1.1, 0.18, -0.4]} rotation={[0.1, 0.3, 0.2]} castShadow>
          <boxGeometry args={[0.45, 0.34, 0.45]} />
          <meshStandardMaterial color="#8a8472" flatShading roughness={0.95} />
        </mesh>
        {/* Pole and gold finial. */}
        <mesh position={[0, POLE_HEIGHT / 2 + 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.17, POLE_HEIGHT, 6]} />
          <meshStandardMaterial color="#7a5230" flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, POLE_HEIGHT + 0.65, 0]} castShadow>
          <icosahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color="#e0a63c" flatShading roughness={0.5} metalness={0.2} />
        </mesh>
        <group position={[0, 0.5, 0]}>
          <Cloth landedAt={landedAt} />
        </group>
      </group>
    </group>
  );
}
