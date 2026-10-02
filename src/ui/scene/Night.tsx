import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, CanvasTexture, type PointLight } from 'three';
import { lanternSpots } from './nightMath';

const LANTERN_COLOR = '#ffa04a';
const LANTERN_LIGHT = '#ff9440';
const POST_COLOR = '#5b3a22';
const ROOF_COLOR = '#3a2616';
/** Height of a lantern post; the lantern box hangs at its top. */
const POST_HEIGHT = 1.6;
/** Light reach and strength of an island lantern, and how much its flame flickers: a small warm pool on the grass. */
const LANTERN_REACH = 12;
const LANTERN_INTENSITY = 28;
const FLICKER = 0.15;

let glow: CanvasTexture | null = null;

/** A soft round glow (white at the center, clear at the edge), shared by every lantern. */
export function glowTexture(): CanvasTexture {
  if (glow) return glow;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  glow = new CanvasTexture(canvas);
  return glow;
}

/** A small low-poly lantern: a glowing box under a little roof, inside a soft warm halo. Lights nothing by itself. */
export function LanternGlow({ halo = 2 }: { readonly halo?: number }) {
  const texture = useMemo(() => glowTexture(), []);
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.42, 0.5, 0.42]} />
        <meshBasicMaterial color={LANTERN_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <coneGeometry args={[0.38, 0.26, 4]} />
        <meshStandardMaterial color={ROOF_COLOR} flatShading />
      </mesh>
      <sprite scale={[halo, halo, 1]}>
        <spriteMaterial map={texture} color={LANTERN_COLOR} transparent opacity={0.45} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

/** A lantern on a wooden post standing on an island, casting a small warm, gently flickering pool of light. */
function PostLantern({ position, seed }: { readonly position: readonly [number, number, number]; readonly seed: number }) {
  const light = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 7 + seed * 13;
    const flicker = 1 - FLICKER * (0.5 + 0.5 * Math.sin(t) * Math.sin(t * 1.7 + 1));
    if (light.current) light.current.intensity = LANTERN_INTENSITY * flicker;
  });
  return (
    <group position={position}>
      <mesh position={[0, POST_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[0.16, POST_HEIGHT, 0.16]} />
        <meshStandardMaterial color={POST_COLOR} flatShading />
      </mesh>
      <group position={[0, POST_HEIGHT + 0.2, 0]}>
        <LanternGlow />
      </group>
      <pointLight ref={light} position={[0, POST_HEIGHT + 0.3, 0]} color={LANTERN_LIGHT} distance={LANTERN_REACH} decay={2} intensity={LANTERN_INTENSITY} />
    </group>
  );
}

/**
 * Moonless night: a lantern post by every dock, the warm accents on a moonlit table. (The moonlight,
 * the sea's vignette and the ship lanterns come from the weather look, `Sea` and `VoyageShip`.)
 */
export function Night({ seatAngles }: { readonly seatAngles: readonly number[] }) {
  const spots = useMemo(() => lanternSpots(seatAngles), [seatAngles]);
  return (
    <group>
      {spots.map((position, i) => (
        <PostLantern key={i} position={position} seed={i} />
      ))}
    </group>
  );
}
