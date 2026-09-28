import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { laneCurve } from './layout';

/** Height above the rolling sea so the chart lines never dip under the waves. */
const LANE_HEIGHT = 0.55;

/** A gently curved sea lane from a guild's dock to the target island, drawn like a chart route. */
function Lane({ angle, color }: { readonly angle: number; readonly color: string }) {
  const points = useMemo(() => laneCurve(angle, LANE_HEIGHT).getPoints(40), [angle]);
  return <Line points={points} color={color} lineWidth={5} dashed dashSize={1.6} gapSize={1} transparent opacity={0.95} />;
}

export function Routes({ angles, colors }: { readonly angles: readonly number[]; readonly colors: readonly string[] }) {
  return (
    <group>
      {angles.map((angle, i) => (
        <Lane key={i} angle={angle} color={colors[i] ?? '#fcf4e2'} />
      ))}
    </group>
  );
}
