import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Path, Shape, ShapeGeometry, type Mesh, type MeshBasicMaterial } from 'three';
import { loopCentre, loopReach, roundedLoop, swollenLoop, type ShorePoint } from './tideOmenMath';

// V0.8 prototype (rules.v08.events, an experiment, not rules): the whole 暗潮將至 round, before the tide takes the goods.
// Dark water stands high round every island and breathes slowly up and down its shore, a rim of foam running out with
// each swell, so the table shows that the tide is coming. The water and the foam follow each island's own waterline
// (the same lines the sea's foam is drawn from), not a circle.

/** How far up the shore the water breathes (sea units), how slowly, and how far past the waterline it and its foam reach. */
const OMEN = { low: 0.6, high: 1.9, period: 5.2, opacity: 0.62, band: 2.1, foamIn: 0.4, foamOut: 1.7, reach: 3.4, foam: 0.85 } as const;
const FOAM = '#b8fff8';
/** Corner-cutting passes on the waterline's straight edges. */
const ROUNDING = 3;

/** A flat shape on the sea plane from a waterline around its own middle (the mesh is laid down by turning it about x). */
const outline = <T extends Path>(into: T, loop: readonly ShorePoint[]): T => {
  loop.forEach(([x, z], i) => (i === 0 ? into.moveTo(x, -z) : into.lineTo(x, -z)));
  into.closePath();
  return into;
};

function HighWater({ loop, color, phase }: { readonly loop: readonly ShorePoint[]; readonly color: string; readonly phase: number }) {
  const water = useRef<Mesh>(null);
  const rim = useRef<Mesh>(null);
  const [cx, cz] = useMemo(() => loopCentre(loop), [loop]);
  const reach = useMemo(() => Math.max(1, loopReach(loop)), [loop]);
  const waterShape = useMemo(() => new ShapeGeometry(outline(new Shape(), roundedLoop(swollenLoop(loop, OMEN.band), ROUNDING))), [loop]);
  const rimShape = useMemo(() => {
    const band = outline(new Shape(), roundedLoop(swollenLoop(loop, OMEN.foamOut), ROUNDING));
    band.holes.push(outline(new Path(), roundedLoop(swollenLoop(loop, OMEN.foamIn), ROUNDING)));
    return new ShapeGeometry(band);
  }, [loop]);
  // Geometry handed to a mesh as a prop is not disposed by react-three-fiber.
  useEffect(() => () => { waterShape.dispose(); rimShape.dispose(); }, [waterShape, rimShape]);
  useFrame(({ clock }) => {
    const [w, r] = [water.current, rim.current];
    if (!w || !r) return;
    // 0 at low water, 1 at the top of the swell.
    const k = 0.5 - 0.5 * Math.cos(((clock.elapsedTime + phase) / OMEN.period) * Math.PI * 2);
    w.position.y = OMEN.low + (OMEN.high - OMEN.low) * k;
    (w.material as MeshBasicMaterial).opacity = OMEN.opacity * (0.6 + 0.4 * k);
    // The rim runs out from the shore as the water comes up and fades at the top.
    r.scale.setScalar(1 + (OMEN.reach / reach) * k);
    (r.material as MeshBasicMaterial).opacity = OMEN.foam * Math.sin(k * Math.PI);
  });
  return (
    <>
      <mesh ref={water} geometry={waterShape} position={[cx, OMEN.low, cz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <meshBasicMaterial color={color} transparent opacity={OMEN.opacity} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={rim} geometry={rimShape} position={[cx, 0.42, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color={FOAM} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

/** `shores`: every guild island's waterlines in world space (an island with a headland or a sandbar has more than one). */
export function TideOmen({ shores, water }: { readonly shores: readonly (readonly ShorePoint[])[]; readonly water: string }) {
  return (
    <>
      {shores.map((loop, i) => (
        // Each island a little out of step, so the table does not pump as one.
        loop.length >= 3 && <HighWater key={i} loop={loop} color={water} phase={i * 1.3} />
      ))}
    </>
  );
}
