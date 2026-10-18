import { useEffect, useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import { useLiveFrame } from '../liveFrame';
import { geometryFromParts } from './Building';
import type { LandmarkTrain } from './islands/design';
import { PUFF_BALL, STEAM_SMOKE, puffOpacity, puffSwell, smokeBallMaterials } from './smokeBall';
import { distanceTo, pointAlong, rushedDistance, type TrackPoint } from './islands/railway';

/** Where the train's car `i` is at `seconds` on the table clock. */
function carAt(train: LandmarkTrain, seconds: number, i: number): TrackPoint {
  return pointAlong(train.path, rushedDistance(train.path, train.shown, train.rush, seconds * train.speed - i * train.spacing));
}

/** An engine and its cars running round their loop of track, each turned to the way the track runs under it, rushing through the rock. */
export function Train({ train }: { readonly train: LandmarkTrain }) {
  const [engine, car] = useMemo(() => [geometryFromParts(train.engine), geometryFromParts(train.car)], [train]);
  const cars = useRef<(Group | null)[]>([]);
  useLiveFrame(({ clock }) => {
    cars.current.forEach((car, i) => {
      if (!car) return;
      const { at, toward } = carAt(train, clock.elapsedTime, i);
      car.position.set(...at);
      // The car's +x runs along the track: its heading about y, then its climb.
      car.rotation.set(0, Math.atan2(-toward[2], toward[0]), Math.asin(Math.max(-1, Math.min(1, toward[1]))), 'YZX');
    });
  });
  return (
    <>
      {Array.from({ length: train.cars }, (_, i) => (
        <group key={i} ref={(car) => void (cars.current[i] = car)}>
          <mesh geometry={i === 0 ? engine : car} castShadow receiveShadow dispose={null}>
            <meshStandardMaterial vertexColors roughness={0.8} />
          </mesh>
        </group>
      ))}
      <EngineSmoke train={train} />
    </>
  );
}

/**
 * Balls of smoke in the air at once, how long each lasts, how high it climbs and how far it streams back
 * behind the engine, its radius as it leaves the chimney (design units) and how many times bigger it grows
 * before it is gone, and how far from each tunnel
 * mouth the engine stops puffing.
 */
const SMOKE = { puffs: 16, life: 3.6, rise: 0.6, back: 0.95, radius: 0.045, grow: 3.2, mouth: 0.12 } as const;

/**
 * Smoke from the engine's chimney, puffed out ball by ball: each round puff leaves the chimney where
 * the engine was when it puffed, then streams back along the track and drifts up and away, swelling
 * and thinning out, so an unbroken string of puffs trails behind the moving train. No puffs near or inside the tunnels.
 */
function EngineSmoke({ train }: { readonly train: LandmarkTrain }) {
  const balls = useRef<(Mesh | null)[]>([]);
  const materials = useMemo(() => smokeBallMaterials(SMOKE.puffs, STEAM_SMOKE), []);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const [open0, open1] = useMemo(() => [distanceTo(train.path, train.shown[0]) + SMOKE.mouth, distanceTo(train.path, train.shown[1]) - SMOKE.mouth], [train]);
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime;
    balls.current.forEach((ball, i) => {
      if (!ball) return;
      const k = ((t / SMOKE.life + i / SMOKE.puffs) % 1 + 1) % 1;
      const engine = rushedDistance(train.path, train.shown, train.rush, (t - k * SMOKE.life) * train.speed);
      ball.visible = engine > open0 && engine < open1;
      if (!ball.visible) return;
      const { at, toward } = pointAlong(train.path, engine);
      // Streams back the way the engine came and drifts up and away, easing off as it goes.
      const back = train.chimney.ahead - SMOKE.back * Math.pow(k, 0.7);
      ball.position.set(at[0] + toward[0] * back, at[1] + train.chimney.up + SMOKE.radius * 0.6 + k * SMOKE.rise, at[2] + toward[2] * back);
      // Pops out of the chimney, then swells as it drifts off and thins away to nothing.
      ball.scale.setScalar(SMOKE.radius * puffSwell(k, SMOKE.grow));
      materials[i]!.opacity = puffOpacity(k);
      ball.rotation.set(i, i * 2, 0);
    });
  });
  return (
    <>
      {materials.map((material, i) => (
        <mesh key={i} geometry={PUFF_BALL} material={material} ref={(b) => void (balls.current[i] = b)} dispose={null} />
      ))}
    </>
  );
}
