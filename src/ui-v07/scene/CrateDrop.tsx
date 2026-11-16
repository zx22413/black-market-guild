import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3, type Group } from 'three';
import type { GoodId } from '../../v07/game';
import { Burst, WaterRing, fan } from './beatFx';
import { CrateModel } from './CrateModel';

// V0.8 prototype (rules.v08.crates, an experiment, not rules): one crate going overboard. It is tossed off the deck
// to one side, tumbles in an arc and goes under where it lands, with a ring and spray on the water. One crate per
// 'drop' cue of the beat, so the losses are counted one at a time.

/** Seconds from leaving the deck to hitting the water. */
export const DROP_FALL = 0.8;
const SINK = 0.5;
const DECK = 2.3;
const REACH = 4.6;
const ARC = 3.2;
const SCALE = 1;
const SPRAY = fan(12, Math.PI * 2, 3.4, 7.5, 5);

/** Where crate `index` hits the water: across the ship, alternating sides, a little further out each pair. */
export function dropLanding(at: Vector3, heading: number, index: number): Vector3 {
  const side = index % 2 === 0 ? 1 : -1;
  const reach = REACH + Math.floor(index / 2) * 1.2;
  return new Vector3(at.x + Math.cos(heading) * side * reach, 0, at.z - Math.sin(heading) * side * reach);
}

/**
 * `at` is the ship on the water, `heading` where its bow points; `index` alternates the side the crate goes over
 * (and reaches a little further each time, so two crates never land in the same spot).
 */
export function CrateDrop({ good, at, heading, index }: { readonly good: GoodId; readonly at: Vector3; readonly heading: number; readonly index: number }) {
  const group = useRef<Group>(null);
  const start = useRef<number | null>(null);
  const side = index % 2 === 0 ? 1 : -1;
  const land = useMemo(() => dropLanding(at, heading, index), [at, heading, index]);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    g.visible = t <= DROP_FALL + SINK;
    if (!g.visible) return;
    const k = Math.min(1, t / DROP_FALL);
    const under = Math.max(0, t - DROP_FALL) / SINK;
    g.position.set(at.x + (land.x - at.x) * k, DECK * (1 - k * k) + Math.sin(k * Math.PI) * ARC - under * 1.8, at.z + (land.z - at.z) * k);
    g.rotation.set(t * 5 * side, t * 2.5, t * 3.5);
  });
  return (
    <>
      <group ref={group} scale={SCALE} position={[at.x, DECK, at.z]}>
        <CrateModel good={good} />
      </group>
      <WaterRing at={land} color="#e9fbff" delay={DROP_FALL} from={0.8} to={4.6} length={0.8} />
      <Burst at={land} particles={SPRAY} color="#e9fbff" size={0.24} delay={DROP_FALL} length={0.7} gravity={9} height={0.5} />
    </>
  );
}
