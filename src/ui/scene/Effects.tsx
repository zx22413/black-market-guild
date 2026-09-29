import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';

const SPLASH_SECONDS = 1.8;
const DROPLETS = 14;

/** Foam ring and flying droplets where a ship goes down; plays once, then stays invisible. */
export function Splash({ position }: { readonly position: readonly [number, number, number] }) {
  const started = useRef<number | null>(null);
  const ring = useRef<Mesh>(null);
  const inner = useRef<Mesh>(null);
  const drops = useRef<Group>(null);
  const velocities = useMemo(
    () =>
      Array.from({ length: DROPLETS }, (_, i) => {
        const a = (i / DROPLETS) * Math.PI * 2;
        const speed = 3 + (i % 3);
        return { x: Math.cos(a) * speed, y: 7 + (i % 4) * 1.5, z: Math.sin(a) * speed };
      }),
    [],
  );

  useFrame(({ clock }) => {
    started.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - started.current;
    const k = Math.min(1, t / SPLASH_SECONDS);
    const fade = 1 - k;
    for (const [mesh, grow] of [
      [ring.current, 9],
      [inner.current, 5],
    ] as const) {
      if (!mesh) continue;
      mesh.scale.setScalar(0.3 + k * grow);
      (mesh.material as MeshBasicMaterial).opacity = fade * 0.9;
    }
    drops.current?.children.forEach((drop, i) => {
      const v = velocities[i]!;
      drop.position.set(v.x * t, Math.max(-1, v.y * t - 9.8 * t * t), v.z * t);
      drop.visible = t < SPLASH_SECONDS;
    });
  });

  return (
    <group position={position}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]}>
        <ringGeometry args={[0.8, 1, 40]} />
        <meshBasicMaterial color="#ffffff" transparent />
      </mesh>
      <mesh ref={inner} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.65, 0]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#e8f7f7" transparent />
      </mesh>
      <group ref={drops}>
        {velocities.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.35, 6, 6]} />
            <meshBasicMaterial color="#f4fbfb" />
          </mesh>
        ))}
      </group>
    </group>
  );
}
