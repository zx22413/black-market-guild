import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide, MeshStandardMaterial, Object3D, Quaternion, Vector3, type InstancedMesh, type Mesh } from 'three';
import { crownGeometry } from './Effects';
import type { SeaPoint } from './islandShape';
import { crestBurst, crestRate, islandDiscs, seaSurfaceY } from './seaWave';
import { burstRate, shoreBurst, type Droplet } from './sprayBursts';
import { useSwell, useWavePhase } from './SwellContext';

/** Droplets alive at once; a burst that would exceed it reuses the oldest slots. */
const POOL = 260;
/** Water sheets alive at once (one per burst). */
const SHEETS = 24;
const GRAVITY = 9.8;
/** Droplets start this far under the surface, so they rise out of the water rather than appear on it. */
const EMERGE = 0.25;
/** ...and vanish once they fall this far back below where they started. */
const SINK = 0.2;
/** How much a droplet stretches along its flight per unit of speed, so it reads as a streak of water. */
const STREAK = 0.16;
const SHEET_SECONDS = 0.6;
/** How far a water sheet leans out, away from the wave that threw it. */
const SHEET_LEAN = 0.45;
/** Water sheets are smooth and see-through, so they read as water rather than white rock. */
const SHEET_OPACITY = 0.55;

const UP = new Vector3(0, 1, 0);

interface Live {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  floor: number;
  alive: boolean;
}

interface Sheet {
  x: number;
  y: number;
  z: number;
  /** Lean direction on the sea plane and how tall the sheet rises. */
  dx: number;
  dz: number;
  height: number;
  age: number;
}

/** Where a burst starts, which way it is thrown, and how hard: the sheet of water under it. */
function sheetOf(droplets: readonly Droplet[]): Omit<Sheet, 'age'> {
  const n = droplets.length;
  const sum = droplets.reduce(
    (acc, d) => [acc[0]! + d.position[0], acc[1]! + d.position[1], acc[2]! + d.position[2], acc[3]! + d.velocity[0], acc[4]! + d.velocity[1], acc[5]! + d.velocity[2]],
    [0, 0, 0, 0, 0, 0],
  );
  const len = Math.hypot(sum[3]!, sum[5]!) || 1;
  return { x: sum[0]! / n, y: sum[1]! / n, z: sum[2]! / n, dx: sum[3]! / len, dz: sum[5]! / len, height: (sum[4]! / n) * 0.3 };
}

interface SprayPoolProps {
  /** Bursts per second right now. */
  readonly rate: () => number;
  /** One burst's droplets, starting at the sea surface; may be empty. */
  readonly burst: (random: () => number) => readonly Droplet[];
}

/**
 * Low-poly spray: each burst throws up a ragged sheet of water that leans out and falls back, with
 * droplets streaking out of it and arcing back into the sea. Per-frame pools, updated in place
 * rather than rebuilt every frame.
 */
function SprayPool({ rate, burst }: SprayPoolProps) {
  const drops = useRef<InstancedMesh>(null);
  const sheetMeshes = useRef<(Mesh | null)[]>([]);
  const pool = useMemo((): Live[] => Array.from({ length: POOL }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, floor: 0, alive: false })), []);
  const sheets = useMemo((): Sheet[] => Array.from({ length: SHEETS }, () => ({ x: 0, y: 0, z: 0, dx: 1, dz: 0, height: 0, age: SHEET_SECONDS })), []);
  const sheetShape = useMemo(() => crownGeometry(), []);
  const sheetMaterials = useMemo(
    () => Array.from({ length: SHEETS }, () => new MeshStandardMaterial({ color: '#f4fbfb', roughness: 0.3, transparent: true, side: DoubleSide, depthWrite: false })),
    [],
  );
  useEffect(
    () => () => {
      sheetShape.dispose();
      sheetMaterials.forEach((m) => m.dispose());
    },
    [sheetShape, sheetMaterials],
  );
  const next = useRef(0);
  const nextSheet = useRef(0);
  const due = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);
  const heading = useMemo(() => new Vector3(), []);
  const lean = useMemo(() => new Quaternion(), []);

  useFrame((_, rawDelta) => {
    const m = drops.current;
    if (!m) return;
    // Clamp so a background tab coming back does not fire a storm of bursts at once.
    const delta = Math.min(rawDelta, 0.05);
    due.current += delta * rate();
    while (due.current >= 1) {
      due.current -= 1;
      const droplets = burst(Math.random);
      if (droplets.length === 0) continue;
      for (const d of droplets) {
        const slot = pool[next.current]!;
        next.current = (next.current + 1) % POOL;
        [slot.x, slot.y, slot.z] = d.position;
        slot.y -= EMERGE;
        slot.floor = slot.y - SINK;
        [slot.vx, slot.vy, slot.vz] = d.velocity;
        slot.size = d.size;
        slot.alive = true;
      }
      Object.assign(sheets[nextSheet.current]!, sheetOf(droplets), { age: 0 });
      nextSheet.current = (nextSheet.current + 1) % SHEETS;
    }

    pool.forEach((p, i) => {
      if (p.alive) {
        p.vy -= GRAVITY * delta;
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.z += p.vz * delta;
        if (p.y < p.floor) p.alive = false;
      }
      // Grow out of the water and shrink back into it; stretch along the flight like a streak.
      const fade = p.alive ? Math.min(1, (p.y - p.floor) / 0.8) : 0;
      const speed = Math.hypot(p.vx, p.vy, p.vz);
      heading.set(p.vx, p.vy, p.vz).normalize();
      dummy.position.set(p.x, p.y, p.z);
      dummy.quaternion.setFromUnitVectors(UP, speed > 0 ? heading : UP);
      dummy.scale.set(p.size * fade, p.size * fade * (1 + speed * STREAK), p.size * fade);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;

    sheets.forEach((s, i) => {
      const mesh = sheetMeshes.current[i];
      if (!mesh) return;
      s.age += delta;
      const k = s.age / SHEET_SECONDS;
      mesh.visible = k < 1;
      if (!mesh.visible) return;
      // Shoot up out of the water, hang, and slump back while the rim opens out.
      const rise = Math.sin(Math.min(1, k * 1.2) * Math.PI) * s.height;
      const spread = 0.35 + k * 0.6;
      mesh.position.set(s.x, s.y - 0.15, s.z);
      lean.setFromAxisAngle(heading.set(s.dz, 0, -s.dx), SHEET_LEAN);
      mesh.quaternion.copy(lean);
      mesh.scale.set(spread, Math.max(0.01, rise), spread);
      sheetMaterials[i]!.opacity = SHEET_OPACITY * (1 - k * k);
    });
  });

  return (
    <>
      <instancedMesh ref={drops} args={[undefined, undefined, POOL]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#f4fbfb" flatShading roughness={0.4} transparent opacity={0.75} />
      </instancedMesh>
      {sheetMaterials.map((material, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            sheetMeshes.current[i] = mesh;
          }}
          geometry={sheetShape}
          material={material}
          visible={false}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

/** Where waves break on the islands: bursts off random stretches of shore, more and higher in rough seas. */
export function ShoreSpray({ shores }: { readonly shores: readonly (readonly SeaPoint[])[] }) {
  const swell = useSwell();
  const phase = useWavePhase();
  return (
    <SprayPool
      rate={() => burstRate(swell.current.foam)}
      burst={(random) => shoreBurst(shores, swell.current.foam, random, (x, z) => seaSurfaceY(x, z, phase.current, swell.current.height))}
    />
  );
}

/** Wave tops breaking in open water when the waves run high, blown downwind. */
export function CrestSpray({ shores }: { readonly shores: readonly (readonly SeaPoint[])[] }) {
  const swell = useSwell();
  const phase = useWavePhase();
  const avoid = useMemo(() => islandDiscs(shores), [shores]);
  return (
    <SprayPool rate={() => crestRate(swell.current.height)} burst={(random) => crestBurst(phase.current, swell.current.height, avoid, random)} />
  );
}
