import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { laneCurve } from './layout';
import { BERTH_GAP } from './Ships';

/** Height above the rolling sea so the chart lines never dip under the waves, even in a storm. */
const LANE_HEIGHT = 0.8;

/** A gently curved sea lane from a guild's dock to the target island, drawn like a chart route. */
function Lane({ angle, color, berth }: { readonly angle: number; readonly color: string; readonly berth: number }) {
  const points = useMemo(() => {
    const curve = laneCurve(angle, LANE_HEIGHT);
    // A lane for a ship riding beside another one is the middle lane moved sideways by the berth.
    return curve.getPoints(40).map((p, i) => {
      const tangent = curve.getTangent(i / 40);
      return p.clone().add(new Vector3(tangent.z, 0, -tangent.x).multiplyScalar(berth * BERTH_GAP));
    });
  }, [angle, berth]);
  return <Line points={points} color={color} lineWidth={5} dashed dashSize={1.6} gapSize={1} transparent opacity={0.95} />;
}

export function Routes({ angles, colors, berths }: { readonly angles: readonly number[]; readonly colors: readonly string[]; /** Each lane's berths (default: the middle one): one dashed line per ship riding there. */ readonly berths?: readonly (readonly number[])[] }) {
  return (
    <group>
      {angles.flatMap((angle, i) => (berths?.[i] && berths[i]!.length > 0 ? berths[i]! : [0]).map((berth) => <Lane key={`${i}|${berth}`} angle={angle} color={colors[i] ?? '#fcf4e2'} berth={berth} />))}
    </group>
  );
}
