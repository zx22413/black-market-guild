import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3, type BufferGeometry, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { playerIslandHeading } from '../../ui/scene/islandShape';
import { seatPosition } from '../../ui/scene/layout';
import type { V08BuildingId } from '../../v07/game';
import { Burst, fan } from './beatFx';
import { FACILITY_LOT, FACILITY_SCALE } from './facilityLot';

// V0.8 prototype (an experiment, not rules): the one building a player raises with materials (修船廠, 軍械庫, 商行),
// standing on their island. The models are built in Blender (scripts/blender/build-facilities.py, design sheet
// docs/art/facilities-concept.svg): `body` carries the palette and baked ambient occlusion in its vertex colours,
// `flag` (the armory's pennant and banner) is painted in the owner's colour. What tells a building apart faces the
// back of the island, the side its owner sees.

const url = (id: V08BuildingId): string => `${import.meta.env.BASE_URL}models/facilities/${id}.glb`;

/** The island's flat top (src/ui/scene/Islands.tsx PLATEAU). */
const PLATEAU = 2.6;
const ORIGIN = new Vector3(0, 0, 0);
/** Seconds the building takes to come down and settle when it is raised on screen. */
const RAISE = 1.1;
const DROP_FROM = 7;
const HOP = 0.6;
const DUST = fan(12, Math.PI * 2, 4.2, 3.2, 3);
const easeOutBack = (t: number): number => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

/**
 * `fresh`: the building was raised while the table was on screen, so it comes down from above, lands with a squash
 * and throws up dust and a gold ring. `pulseKey`: each new key makes it hop once with a gold ring (the building just
 * did its work: saved a crate, turned a tide away).
 */
export function Facility({ angle, building, color, fresh = false, pulseKey = null }: { readonly angle: number; readonly building: V08BuildingId; readonly color: string; readonly fresh?: boolean; readonly pulseKey?: string | null }) {
  const { scene } = useGLTF(url(building));
  const meshes = useMemo(() => {
    const found = new Map<string, BufferGeometry>();
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) found.set(o.name, (o as Mesh).geometry);
    });
    const body = found.get('body');
    if (!body) throw new Error(`no body mesh in ${url(building)}`);
    return { body, flag: found.get('flag') };
  }, [scene, building]);
  const model = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const raisedAt = useRef<number | null>(null);
  const hop = useRef<{ key: string | null; at: number | null }>({ key: pulseKey, at: null });
  useFrame(({ clock }) => {
    const g = model.current;
    const r = ring.current;
    if (!g || !r) return;
    const now = clock.elapsedTime;
    if (hop.current.key !== pulseKey) hop.current = { key: pulseKey, at: pulseKey === null ? null : now };
    let y = 0;
    let squash = 1;
    let size = 1;
    let glow = -1;
    if (fresh) {
      raisedAt.current ??= now;
      const t = (now - raisedAt.current) / RAISE;
      if (t < 0.45) {
        const k = t / 0.45;
        y = DROP_FROM * (1 - k * k);
        size = 0.7 + 0.3 * k;
      } else if (t < 1) {
        const k = (t - 0.45) / 0.55;
        squash = 0.78 + 0.22 * easeOutBack(k);
        glow = k;
      }
    }
    if (hop.current.at !== null) {
      const k = (now - hop.current.at) / HOP;
      if (k >= 1) hop.current = { ...hop.current, at: null };
      else {
        y += Math.sin(k * Math.PI) * 0.9;
        squash *= 1 + 0.12 * Math.sin(k * Math.PI * 2);
        glow = k;
      }
    }
    g.position.y = y;
    g.scale.set(size * (2 - squash) ** 0.5, size * squash, size * (2 - squash) ** 0.5);
    r.visible = glow >= 0;
    if (r.visible) {
      r.scale.setScalar(1 + glow * 2.2);
      (r.material as MeshBasicMaterial).opacity = 0.85 * (1 - glow);
    }
  });
  return (
    <group position={seatPosition(angle)} rotation={[0, playerIslandHeading(angle), 0]}>
      <group position={[FACILITY_LOT[0], PLATEAU, FACILITY_LOT[2]]} scale={FACILITY_SCALE}>
        <group ref={model}>
          <mesh geometry={meshes.body} castShadow receiveShadow dispose={null}>
            <meshStandardMaterial vertexColors flatShading roughness={0.8} />
          </mesh>
          {meshes.flag && (
            <mesh geometry={meshes.flag} castShadow dispose={null}>
              <meshStandardMaterial color={color} flatShading roughness={0.8} side={2} />
            </mesh>
          )}
        </group>
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} visible={false}>
          <ringGeometry args={[2.2, 2.6, 40]} />
          <meshBasicMaterial color="#ffd36b" transparent toneMapped={false} depthWrite={false} />
        </mesh>
        {fresh && <Burst at={ORIGIN} particles={DUST} color="#e9dcc0" size={0.3} delay={RAISE * 0.45} length={0.8} gravity={6} height={0.3} />}
      </group>
    </group>
  );
}
