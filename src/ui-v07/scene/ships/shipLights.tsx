import { useMemo, useRef } from 'react';
import { AdditiveBlending, type Group, type Mesh, type SpriteMaterial } from 'three';
import { useLiveFrame } from '../../../ui/scene/liveFrame';
import { glowTexture } from '../../../ui/scene/Night';

/** A warm lantern flame, and the ghost ship's cold one. */
export const FLAME_WARM = '#ffa04a';
export const FLAME_GHOST = '#7ff0d4';

/**
 * The flame inside a lantern frame (`hull.ts` `lanternFrame`): only the flame and a soft halo round it light up, never the
 * frame. By day it is an unlit candle.
 */
export function LanternFlame({ at, color, lit }: { readonly at: readonly [number, number, number]; readonly color: string; readonly lit: boolean }) {
  const texture = useMemo(() => glowTexture(), []);
  const flame = useRef<Mesh>(null);
  const halo = useRef<SpriteMaterial>(null);
  const seed = useMemo(() => Math.random() * 10, []);
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime * 9 + seed;
    const flicker = 0.85 + 0.15 * Math.sin(t) * Math.sin(t * 1.7 + 1);
    flame.current?.scale.set(1, 1.6 * flicker, 1);
    if (halo.current) halo.current.opacity = 0.55 * flicker;
  });
  return (
    <group position={[...at]}>
      <mesh position={[0, -0.09, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.1, 6]} />
        <meshStandardMaterial color="#fde4c7" flatShading />
      </mesh>
      {lit && (
        <>
          <mesh ref={flame} position={[0, 0.02, 0]}>
            <octahedronGeometry args={[0.075, 0]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <sprite scale={[1.5, 1.5, 1]}>
            <spriteMaterial ref={halo} map={texture} color={color} transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        </>
      )}
    </group>
  );
}

/** Where each will-o'-the-wisp drifts round the ghost ship: its circle's radius, height, speed and starting angle. */
const WISPS = [
  { radius: 2.6, height: 1.6, speed: 0.35, start: 0 },
  { radius: 3.1, height: 2.4, speed: -0.28, start: 1.7 },
  { radius: 2.2, height: 3.2, speed: 0.22, start: 3.4 },
  { radius: 3.4, height: 1.2, speed: -0.4, start: 4.6 },
  { radius: 2.8, height: 2.8, speed: 0.3, start: 5.6 },
] as const;

/**
 * 幽靈號 at night: will-o'-the-wisps, cold green flames drifting round the ship on slow loops, bobbing, swelling and
 * fading in turn.
 */
export function WillOWisps() {
  const texture = useMemo(() => glowTexture(), []);
  const groups = useRef<(Group | null)[]>([]);
  const halos = useRef<(SpriteMaterial | null)[]>([]);
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime;
    WISPS.forEach((w, i) => {
      const g = groups.current[i];
      if (!g) return;
      const a = w.start + t * w.speed;
      // A wobbly loop round the hull, longer fore and aft than across.
      g.position.set(Math.cos(a) * w.radius * 0.75, w.height + 0.35 * Math.sin(t * 1.3 + i * 2), Math.sin(a) * w.radius * 1.15);
      const breath = 0.5 + 0.5 * Math.sin(t * (1.1 + i * 0.3) + i * 1.9);
      g.scale.setScalar(0.7 + 0.5 * breath);
      const halo = halos.current[i];
      if (halo) halo.opacity = 0.25 + 0.55 * breath;
    });
  });
  return (
    <>
      {WISPS.map((_, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)}>
          <mesh scale={[1, 1.5, 1]}>
            <octahedronGeometry args={[0.16, 0]} />
            <meshBasicMaterial color={FLAME_GHOST} toneMapped={false} />
          </mesh>
          <sprite scale={[2.1, 2.1, 1]}>
            <spriteMaterial ref={(m) => void (halos.current[i] = m)} map={texture} color={FLAME_GHOST} transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        </group>
      ))}
    </>
  );
}
