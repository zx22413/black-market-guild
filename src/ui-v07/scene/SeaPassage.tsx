import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { laneCurve } from '../../ui/scene/layout';
import { BERTH_GAP, shipPose } from '../../ui/scene/Ships';
import type { ShipState } from '../../ui/scene/tableModel';
import { WaterRing } from './beatFx';

// A ship that sails over more than one round (the freighter, game-design.md §8.1) is drawn along its lane:
// a solid route in its guild's colour from the dock out to where it rides, with a wake ring at the dock as
// it casts off and another at its berth as it comes in to be resolved.

/** Height of the route above the rolling sea (a little over the chart lines of Routes). */
const PASSAGE_HEIGHT = 1;
/** How many points a full route is drawn with. */
const STEPS = 28;
/** The route grows in steps this fine (as a share of the lane), so it redraws a few times, not every frame. */
const GROW_STEP = 0.02;
/** How fast the route grows (per second, exponential), a little slower than the ship glides so it trails behind the bow. */
const GROW_RATE = 1.6;
/** Where along the lane an at-sea ship rides (Ships.tsx LANE_T.atSea). */
const AT_SEA_T = 0.3;

interface Ring {
  readonly key: number;
  readonly at: Vector3;
}

export interface SeaPassageProps {
  readonly angle: number;
  readonly color: string;
  readonly state: ShipState;
  readonly berth: number;
}

export function SeaPassage({ angle, color, state, berth }: SeaPassageProps) {
  const atSea = state === 'atSea';
  const curve = useMemo(() => laneCurve(angle, PASSAGE_HEIGHT), [angle]);
  const side = berth * BERTH_GAP;
  const [shown, setShown] = useState(atSea ? AT_SEA_T : 0);
  const exact = useRef(shown);
  const target = atSea ? AT_SEA_T : 0;
  useFrame((_, delta) => {
    exact.current += (target - exact.current) * (1 - Math.exp(-Math.min(delta, 0.1) * GROW_RATE));
    const snapped = Math.abs(target - exact.current) < GROW_STEP / 2 ? target : Math.round(exact.current / GROW_STEP) * GROW_STEP;
    setShown((was) => (was === snapped ? was : snapped));
  });

  // Rings: at the dock when it casts off, at its berth when it leaves the sea for the voyage.
  const [rings, setRings] = useState<readonly Ring[]>([]);
  const previous = useRef(state);
  const born = useRef(0);
  useEffect(() => {
    const was = previous.current;
    previous.current = state;
    if (was === state) return;
    const point = (s: ShipState) => shipPose(angle, s, berth).position.clone();
    if (state === 'atSea' && was === 'docked') setRings((r) => [...r, { key: born.current++, at: point('docked') }]);
    if (was === 'atSea') setRings((r) => [...r, { key: born.current++, at: point('atSea') }]);
  }, [state, angle, berth]);

  const points = useMemo(() => {
    if (shown < GROW_STEP * 2) return null;
    return Array.from({ length: STEPS + 1 }, (_, i) => {
      const t = (shown * i) / STEPS;
      const p = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      return new Vector3(p.x + tangent.z * side, PASSAGE_HEIGHT, p.z - tangent.x * side);
    });
  }, [curve, shown, side]);

  return (
    <group>
      {points && <Line points={points} color={color} lineWidth={7} transparent opacity={0.9} />}
      {rings.map((ring) => (
        <group key={ring.key}>
          <WaterRing at={ring.at} color={color} delay={0} from={1.5} to={9} length={1.6} />
          <WaterRing at={ring.at} color="#fcf4e2" delay={0.35} from={1.5} to={6.5} length={1.4} />
        </group>
      ))}
    </group>
  );
}
