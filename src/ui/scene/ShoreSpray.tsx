import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Object3D, type InstancedMesh } from 'three';
import type { SeaPoint } from './islandShape';
import { burstRate, shoreBurst } from './sprayBursts';
import { useSwell } from './SwellContext';

/** Droplets alive at once; a burst that would exceed it reuses the oldest slots. */
const POOL = 160;
const GRAVITY = 9.8;
/** Droplets fall back under the sea surface before they vanish. */
const SINK_Y = -0.4;

interface Live {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  alive: boolean;
}

/**
 * Low-poly spray where waves break on the islands: small bursts of droplets thrown up off random
 * stretches of shore, more often and higher in rough seas. A per-frame particle pool, so it is
 * updated in place rather than rebuilt every frame.
 */
export function ShoreSpray({ shores }: { readonly shores: readonly (readonly SeaPoint[])[] }) {
  const swell = useSwell();
  const mesh = useRef<InstancedMesh>(null);
  const pool = useMemo((): Live[] => Array.from({ length: POOL }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, alive: false })), []);
  const next = useRef(0);
  const due = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);

  useFrame((_, rawDelta) => {
    const m = mesh.current;
    if (!m) return;
    // Clamp so a background tab coming back does not fire a storm of bursts at once.
    const delta = Math.min(rawDelta, 0.05);
    const foam = swell.current.foam;
    due.current += delta * burstRate(foam);
    while (due.current >= 1) {
      due.current -= 1;
      for (const d of shoreBurst(shores, foam, Math.random)) {
        const slot = pool[next.current]!;
        next.current = (next.current + 1) % POOL;
        [slot.x, slot.y, slot.z] = d.position;
        [slot.vx, slot.vy, slot.vz] = d.velocity;
        slot.size = d.size;
        slot.alive = true;
      }
    }
    pool.forEach((p, i) => {
      if (p.alive) {
        p.vy -= GRAVITY * delta;
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.z += p.vz * delta;
        if (p.y < SINK_Y) p.alive = false;
      }
      dummy.position.set(p.x, p.y, p.z);
      // Shrink as the droplet falls back, so it melts into the sea instead of popping out.
      const fade = p.alive ? Math.min(1, (p.y - SINK_Y) / 0.8) : 0;
      dummy.scale.setScalar(p.size * fade);
      dummy.rotation.set(p.x, p.z, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, POOL]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#f4fbfb" flatShading roughness={0.4} transparent opacity={0.85} />
    </instancedMesh>
  );
}
