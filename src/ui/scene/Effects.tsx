import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { CylinderGeometry, DoubleSide, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import { Model, type ModelName } from './Model';

/** How long the whole sinking scene plays before it removes itself. */
const SINK_SECONDS = 9;
const DROPLETS = 10;
const DROPLET_SECONDS = 1.5;
const BUBBLES = 14;
/** Bubbles keep coming up for this long after the ship goes down. */
const BUBBLE_SPAN = 3;
const BUBBLE_RISE = 0.7;
/** When the cargo surfaces and when it starts to sink again. */
const DEBRIS_SURFACE = 0.6;
const DEBRIS_SINK = 6.5;

/** Cargo that floats up from the wreck and drifts away from it. */
const DEBRIS: readonly { readonly model: ModelName; readonly scale: number; readonly angle: number; readonly drift: number }[] = [
  { model: 'barrel', scale: 0.55, angle: 0.5, drift: 3.2 },
  { model: 'crate', scale: 0.6, angle: 2.6, drift: 2.6 },
  { model: 'barrel', scale: 0.45, angle: 4.4, drift: 3.6 },
];

/** Deterministic value in [0, 1) per index, so the scene looks the same every time. */
const hash = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);

const CROWN_SECONDS = 1.3;
/** Wave rings rolling out from the wreck: start delay, seconds to roll out, and how far. */
const RINGS: readonly { readonly delay: number; readonly seconds: number; readonly reach: number }[] = [
  { delay: 0, seconds: 2.4, reach: 9 },
  { delay: 0.45, seconds: 2.6, reach: 7 },
];
/** Peak height of a wave ring above its base, and the torus tube it is stretched from. */
const RING_HEIGHT = 1.1;
const RING_TUBE = 0.09;

/** An open, flaring cylinder with a ragged rim: the wall of water thrown up as the ship goes under. */
function crownGeometry(): CylinderGeometry {
  const g = new CylinderGeometry(1.25, 0.8, 1, 12, 1, true);
  const position = g.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) > 0) position.setY(i, 0.5 + (hash(i % 13, 9) - 0.5) * 0.7);
  }
  position.needsUpdate = true;
  g.translate(0, 0.5, 0);
  g.computeVertexNormals();
  return g;
}

const fadeOf = (mesh: Mesh, opacity: number) => {
  (mesh.material as MeshStandardMaterial).opacity = opacity;
};

/**
 * The water closing over the ship: a ragged crown of water shoots up and falls back, and faceted
 * wave rings with real height roll outward, flattening and fading as they go.
 */
function SinkSurge({ elapsed }: { readonly elapsed: { readonly current: number } }) {
  const crown = useRef<Mesh>(null);
  const rings = useRef<Group>(null);
  const crownShape = useMemo(() => crownGeometry(), []);

  useFrame(() => {
    const t = elapsed.current;
    const c = crown.current;
    if (c) {
      const k = t / CROWN_SECONDS;
      c.visible = k < 1;
      if (c.visible) {
        // Shoot up fast, hang, and fall back while the rim keeps opening out.
        const height = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 2.6;
        const spread = 1.6 + easeOut(k) * 2.4;
        c.scale.set(spread, Math.max(0.01, height), spread);
        fadeOf(c, 0.9 * (1 - k * k));
      }
    }
    rings.current?.children.forEach((child, i) => {
      const ring = child as Mesh;
      const r = RINGS[i]!;
      const k = (t - r.delay) / r.seconds;
      ring.visible = k > 0 && k < 1;
      if (!ring.visible) return;
      const radius = 1.5 + easeOut(k) * r.reach;
      ring.scale.set(radius, radius, (RING_HEIGHT * (1 - k) + 0.05) / RING_TUBE);
      fadeOf(ring, 0.85 * (1 - k));
    });
  });

  return (
    <group>
      <mesh ref={crown} geometry={crownShape} position={[0, -0.2, 0]}>
        <meshStandardMaterial color="#f4fbfb" flatShading roughness={0.4} transparent side={DoubleSide} />
      </mesh>
      <group ref={rings}>
        {RINGS.map((_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, i * 0.4]} position={[0, -0.05, 0]} visible={false}>
            <torusGeometry args={[1, RING_TUBE, 4, 18]} />
            <meshStandardMaterial color="#eef9f9" flatShading roughness={0.5} transparent />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * A ship going down: a crown of water and wave rings rolling out, a burst of spray, a trail of bubbles rising where it sank, and a few barrels
 * and crates that bob up, drift away and slowly sink. Plays once, then removes itself.
 */
export function SinkEffect({ position }: { readonly position: readonly [number, number, number] }) {
  const started = useRef<number | null>(null);
  const elapsed = useRef(0);
  const [done, setDone] = useState(false);
  const drops = useRef<Group>(null);
  const bubbles = useRef<Group>(null);
  const debris = useRef<Group>(null);
  const dropVelocity = useMemo(
    () =>
      Array.from({ length: DROPLETS }, (_, i) => {
        const a = (i / DROPLETS) * Math.PI * 2 + hash(i, 1);
        const speed = 2 + hash(i, 2) * 2;
        return { x: Math.cos(a) * speed, y: 5 + hash(i, 3) * 3, z: Math.sin(a) * speed };
      }),
    [],
  );
  const bubbleSpots = useMemo(
    () =>
      Array.from({ length: BUBBLES }, (_, i) => {
        const a = hash(i, 4) * Math.PI * 2;
        const r = hash(i, 5) * 1.8;
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, delay: (i / BUBBLES) * BUBBLE_SPAN + hash(i, 6) * 0.3, size: 0.3 + hash(i, 7) * 0.25 };
      }),
    [],
  );

  useFrame(({ clock }) => {
    started.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - started.current;
    elapsed.current = t;
    if (t > SINK_SECONDS) {
      setDone(true);
      return;
    }
    drops.current?.children.forEach((drop, i) => {
      const v = dropVelocity[i]!;
      drop.position.set(v.x * t, v.y * t - 4.9 * t * t, v.z * t);
      drop.visible = t < DROPLET_SECONDS && drop.position.y > -0.5;
    });
    bubbles.current?.children.forEach((bubble, i) => {
      const spot = bubbleSpots[i]!;
      const k = (t - spot.delay) / BUBBLE_RISE;
      bubble.visible = k > 0 && k < 1;
      if (!bubble.visible) return;
      // Rise from under the surface, swell a little, and pop as it breaks the surface.
      bubble.position.set(spot.x + Math.sin(k * 9 + i) * 0.12, -0.6 + k * 0.95, spot.z);
      bubble.scale.setScalar(spot.size * (0.6 + k * 0.6));
    });
    debris.current?.children.forEach((item, i) => {
      const d = DEBRIS[i]!;
      const since = t - DEBRIS_SURFACE;
      item.visible = since > 0;
      if (!item.visible) return;
      const out = d.drift * (1 - Math.exp(-since * 0.45));
      const rise = easeOut(Math.min(1, since / 0.8));
      const sink = Math.max(0, t - DEBRIS_SINK) * 0.5;
      item.position.set(Math.cos(d.angle) * out, -1 + rise * 1.05 + Math.sin(t * 2 + i * 2) * 0.08 - sink, Math.sin(d.angle) * out);
      item.rotation.set(Math.sin(t * 1.3 + i) * 0.15, d.angle + since * 0.2, Math.cos(t * 1.1 + i) * 0.15);
    });
  });

  if (done) return null;
  return (
    <group position={position}>
      <SinkSurge elapsed={elapsed} />
      <group ref={drops}>
        {dropVelocity.map((_, i) => (
          <mesh key={i} scale={0.22 + hash(i, 8) * 0.12}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#f4fbfb" flatShading roughness={0.4} transparent opacity={0.85} />
          </mesh>
        ))}
      </group>
      <group ref={bubbles}>
        {bubbleSpots.map((_, i) => (
          <mesh key={i} visible={false}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#e8f7f7" flatShading roughness={0.2} transparent opacity={0.6} />
          </mesh>
        ))}
      </group>
      <group ref={debris}>
        {DEBRIS.map((d, i) => (
          <group key={i} visible={false}>
            <Model name={d.model} scale={d.scale} />
          </group>
        ))}
      </group>
    </group>
  );
}
