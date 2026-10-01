import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { Object3D, Quaternion, Vector3, type AmbientLight, type DirectionalLight, type InstancedMesh, type Mesh, type MeshBasicMaterial } from 'three';
import { FLASH_SECONDS, boltPath, flashLevel, nextStrikeDelay, strikePoint, type ScenePoint } from './stormMath';

/** Rain falls through a box over the whole table, wider than deep like the table itself. */
const RAIN_DROPS = 380;
/** `top` sets each streak's lifetime: it falls from there to the sea in about 0.6 s. */
const RAIN_AREA = { x: 110, z: 85, top: 24 } as const;
/** Fall velocity: steep, blown toward the lower left of the screen (-x, toward the camera at +z). */
const RAIN_VELOCITY = new Vector3(-14, -40, 8);
const RAIN_OPACITY = 0.32;
/** Seconds for the rain to build up after the storm is revealed. */
const RAIN_FADE_IN = 1.5;
const BOLT_HEIGHT = 45;

/** Slanted low-poly rain streaks falling over the table, wrapping back to the top as they land. */
function Rain() {
  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const age = useRef(0);
  const drops = useMemo(
    () => Float32Array.from({ length: RAIN_DROPS * 3 }, (_, i) => {
      const axis = i % 3;
      if (axis === 0) return (Math.random() - 0.5) * 2 * RAIN_AREA.x;
      if (axis === 1) return Math.random() * RAIN_AREA.top;
      return (Math.random() - 0.5) * 2 * RAIN_AREA.z;
    }),
    [],
  );
  // Every streak points along the fall direction.
  const tilt = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), RAIN_VELOCITY.clone().normalize()), []);
  const dummy = useMemo(() => new Object3D(), []);

  useFrame((_, rawDelta) => {
    const m = mesh.current;
    if (!m) return;
    const delta = Math.min(rawDelta, 0.05);
    age.current += delta;
    if (material.current) material.current.opacity = RAIN_OPACITY * Math.min(1, age.current / RAIN_FADE_IN);
    dummy.quaternion.copy(tilt);
    for (let i = 0; i < RAIN_DROPS; i++) {
      let x = drops[i * 3]! + RAIN_VELOCITY.x * delta;
      let y = drops[i * 3 + 1]! + RAIN_VELOCITY.y * delta;
      let z = drops[i * 3 + 2]! + RAIN_VELOCITY.z * delta;
      if (y < 0) {
        // Landed: start again at the top, somewhere else over the table.
        x = (Math.random() - 0.5) * 2 * RAIN_AREA.x;
        y += RAIN_AREA.top;
        z = (Math.random() - 0.5) * 2 * RAIN_AREA.z;
      }
      drops[i * 3] = x;
      drops[i * 3 + 1] = y;
      drops[i * 3 + 2] = z;
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, RAIN_DROPS]} frustumCulled={false}>
      <boxGeometry args={[0.16, 3.2, 0.16]} />
      <meshBasicMaterial ref={material} color="#dfe9ef" transparent opacity={0} depthWrite={false} />
    </instancedMesh>
  );
}

/**
 * Lightning every few seconds over open sea between the islands: a jagged bolt drops to the water
 * while the whole table flashes with a cold light, flickers and goes dark again.
 */
function Lightning({ seatAngles }: { readonly seatAngles: readonly number[] }) {
  const ambient = useRef<AmbientLight>(null);
  const key = useRef<DirectionalLight>(null);
  // Strike times follow the real clock, so storms keep their rhythm even at a low frame rate.
  const nextAt = useRef<number | null>(null);
  const struckAt = useRef(-Infinity);
  const boltGroup = useRef<Object3D>(null);
  const impactRef = useRef<Mesh>(null);

  // Each bolt is laid out (hidden) ahead of its strike, so it is already drawn on the brightest
  // first frame of the flash; the next one is laid out once the current flash has faded.
  const newBolt = () => boltPath(strikePoint(seatAngles, Math.random), BOLT_HEIGHT, Math.random);
  const [bolt, setBolt] = useState<ScenePoint[]>(newBolt);
  const relaid = useRef(true);

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    nextAt.current ??= now + nextStrikeDelay(Math.random);
    if (now >= nextAt.current) {
      struckAt.current = now;
      nextAt.current = now + nextStrikeDelay(Math.random);
      relaid.current = false;
    }
    if (!relaid.current && now - struckAt.current > FLASH_SECONDS) {
      relaid.current = true;
      setBolt(newBolt());
    }
    const flash = flashLevel(now - struckAt.current);
    if (ambient.current) ambient.current.intensity = flash * 1.1;
    if (key.current) key.current.intensity = flash * 3;
    if (boltGroup.current) boltGroup.current.visible = flash > 0.15;
    const impact = impactRef.current;
    if (impact) {
      // A bright burst where the bolt meets the water, swelling as it fades.
      impact.visible = flash > 0.05;
      impact.scale.setScalar(1.2 + (1 - flash) * 2.5);
      (impact.material as MeshBasicMaterial).opacity = flash * 0.9;
    }
  });

  return (
    <>
      <ambientLight ref={ambient} color="#dfe6ff" intensity={0} />
      <directionalLight ref={key} color="#e8eeff" position={[10, 80, -20]} intensity={0} />
      <group ref={boltGroup} visible={false}>
        <Line points={bolt as [number, number, number][]} color="#b9c8ff" lineWidth={16} transparent opacity={0.3} />
        <Line points={bolt as [number, number, number][]} color="#fbfbff" lineWidth={5} />
      </group>
      <mesh ref={impactRef} position={bolt[bolt.length - 1] as [number, number, number]} visible={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#f4f6ff" transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

/** Storm weather: driving rain over the table and lightning striking the open sea. */
export function Storm({ seatAngles }: { readonly seatAngles: readonly number[] }) {
  return (
    <>
      <Rain />
      <Lightning seatAngles={seatAngles} />
    </>
  );
}
