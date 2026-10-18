import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';

// Small effects on the water shared by the ship beat's hits and the islands at work: a ring that
// grows on the sea and a burst of particles (sparks, splinters, glitter, spray).

/** A ring on the water that grows from `radius` and fades, starting `delay` seconds into the effect. */
export function WaterRing({ at, color, delay, from, to, length }: { readonly at: Vector3; readonly color: string; readonly delay: number; readonly from: number; readonly to: number; readonly length: number }) {
  const mesh = useRef<Mesh>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current - delay;
    m.visible = t >= 0 && t <= length;
    if (!m.visible) return;
    const k = t / length;
    m.scale.setScalar(from + (to - from) * (1 - (1 - k) ** 2));
    (m.material as MeshBasicMaterial).opacity = 0.9 * (1 - k);
  });
  return (
    <mesh ref={mesh} position={[at.x, 0.4, at.z]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.85, 1, 40]} />
      <meshBasicMaterial color={color} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

export interface Particle {
  /** Unit direction on the water plane. */
  readonly dir: readonly [number, number];
  readonly up: number;
  readonly speed: number;
  readonly spin: number;
}

/** Particles thrown out of `at` (sparks, splinters, glitter); a fixed fan, so the look never changes between plays. */
export function Burst({ at, particles, color, size, delay, length, gravity, box = false, facing = 0, height = 2.4 }: {
  readonly at: Vector3;
  readonly particles: readonly Particle[];
  readonly color: string;
  readonly size: number;
  readonly delay: number;
  readonly length: number;
  readonly gravity: number;
  readonly box?: boolean;
  /** Fan centre (radians around the vertical axis); particles spread over ±arc around it. */
  readonly facing?: number;
  /** How high above the sea it bursts (just above the deck by default). */
  readonly height?: number;
}) {
  const group = useRef<Group>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current - delay;
    g.visible = t >= 0 && t <= length;
    if (!g.visible) return;
    const k = t / length;
    g.children.forEach((child, i) => {
      const q = particles[i]!;
      child.position.set(q.dir[0] * q.speed * t, Math.max(0, q.up * t - gravity * t * t), q.dir[1] * q.speed * t);
      child.rotation.set(t * q.spin, t * q.spin * 0.7, 0);
      child.scale.setScalar(1 - k * 0.8);
      ((child as Mesh).material as MeshBasicMaterial).opacity = 1 - k * k;
    });
  });
  return (
    <group ref={group} position={[at.x, height, at.z]} rotation={[0, facing, 0]} visible={false}>
      {particles.map((_, i) => (
        <mesh key={i}>
          {box ? <boxGeometry args={[size, size * 0.6, size * 2]} /> : <sphereGeometry args={[size, 8, 6]} />}
          <meshBasicMaterial color={color} transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** A fan of `n` particles spread over `arc` radians around +z (the group's `facing` aims it). */
export const fan = (n: number, arc: number, speed: number, up: number, spin: number): Particle[] =>
  Array.from({ length: n }, (_, i) => {
    const a = n === 1 ? 0 : -arc / 2 + (arc * i) / (n - 1);
    const wobble = 0.75 + 0.25 * Math.sin(i * 12.9898);
    return { dir: [Math.sin(a), Math.cos(a)] as const, up: up * wobble, speed: speed * wobble, spin: spin * (i % 2 === 0 ? 1 : -1) };
  });
