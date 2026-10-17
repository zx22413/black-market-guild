import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { QuadraticBezierCurve3, Quaternion, TubeGeometry, Vector3, type Mesh, type MeshBasicMaterial } from 'three';
import type { RoleArrow } from './revealModel';

// Arrows in the air from a player's island to what its role targets. Each grows from the island
// to the target when it appears (so the eye follows who points at whom), then stays.

const GROW_SECONDS = 0.7;
const UP = new Vector3(0, 1, 0);

function Arrow({ arrow, color, dim }: { readonly arrow: RoleArrow; readonly color: string; readonly dim: boolean }) {
  const curve = useMemo(() => new QuadraticBezierCurve3(new Vector3(...arrow.from), new Vector3(...arrow.control), new Vector3(...arrow.to)), [arrow]);
  const radius = arrow.faint ? 0.12 : 0.5;
  const geometry = useMemo(() => new TubeGeometry(curve, 40, radius, 6, false), [curve, radius]);
  const tube = useRef<Mesh>(null);
  const head = useRef<Mesh>(null);
  const born = useRef<number | null>(null);
  const opacity = arrow.faint ? 0.35 : dim ? 0.55 : 1;

  useFrame(({ clock }) => {
    born.current ??= clock.elapsedTime;
    const k = Math.min(1, (clock.elapsedTime - born.current) / GROW_SECONDS);
    const t = tube.current;
    // Draw only the grown part of the tube: TubeGeometry indices run along the curve.
    if (t) t.geometry.setDrawRange(0, Math.floor(geometry.index!.count * k));
    const h = head.current;
    if (h) {
      const at = curve.getPoint(Math.max(0.02, k));
      h.position.copy(at);
      h.quaternion.copy(new Quaternion().setFromUnitVectors(UP, curve.getTangent(Math.max(0.02, k)).normalize()));
      h.visible = !arrow.faint;
    }
    for (const m of [t, h]) if (m) (m.material as MeshBasicMaterial).opacity = opacity;
  });

  return (
    <group>
      <mesh ref={tube} geometry={geometry}>
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <mesh ref={head}>
        <coneGeometry args={[radius * 3, radius * 7, 10]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function RoleArrows({ arrows, colorOf, dimmed }: { readonly arrows: readonly RoleArrow[]; readonly colorOf: (id: string) => string; readonly dimmed: (a: RoleArrow) => boolean }) {
  return (
    <>
      {arrows.map((a) => (
        <Arrow key={a.key} arrow={a} color={colorOf(a.playerId)} dim={dimmed(a)} />
      ))}
    </>
  );
}

const DOTS = 16;

/** A dashed arrow for a pick not yet submitted: dots along the curve that appear one by one. */
function DashedArrow({ arrow, color }: { readonly arrow: RoleArrow; readonly color: string }) {
  const curve = useMemo(() => new QuadraticBezierCurve3(new Vector3(...arrow.from), new Vector3(...arrow.control), new Vector3(...arrow.to)), [arrow]);
  // Every other dot is drawn, which reads as a dashed line; the tip is left to the arrowhead.
  const points = useMemo(() => Array.from({ length: DOTS }, (_, i) => curve.getPoint((i + 0.5) / (DOTS + 1))), [curve]);
  const dots = useRef<(Mesh | null)[]>([]);
  const head = useRef<Mesh>(null);
  const born = useRef<number | null>(null);
  const radius = arrow.faint ? 0.35 : 0.8;
  const opacity = arrow.faint ? 0.4 : 0.95;

  useFrame(({ clock }) => {
    born.current ??= clock.elapsedTime;
    const k = Math.min(1, (clock.elapsedTime - born.current) / GROW_SECONDS);
    dots.current.forEach((m, i) => {
      if (m) m.visible = i % 2 === 0 && (i + 1) / DOTS <= k;
    });
    const h = head.current;
    if (h) {
      h.visible = !arrow.faint && k >= 1;
      h.position.copy(curve.getPoint(1));
      h.quaternion.copy(new Quaternion().setFromUnitVectors(UP, curve.getTangent(1).normalize()));
    }
  });

  return (
    <group>
      {points.map((p, i) => (
        <mesh
          key={i}
          ref={(m) => {
            dots.current[i] = m;
          }}
          position={p}
          visible={false}
        >
          <sphereGeometry args={[radius, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={head} visible={false}>
        <coneGeometry args={[radius * 3, radius * 7, 10]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function DashedArrows({ arrows, color }: { readonly arrows: readonly RoleArrow[]; readonly color: string }) {
  return (
    <>
      {arrows.map((a) => (
        <DashedArrow key={`${a.key}-${a.to.join()}`} arrow={a} color={color} />
      ))}
    </>
  );
}
