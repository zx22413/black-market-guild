import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import { AdditiveBlending, DoubleSide, NormalBlending, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { PLAYER_ISLAND_RADIUS, seatPosition } from '../../ui/scene/layout';
import { pulseFrame } from './pulseMath';

// An island that just counted (docs/game-design.md §11.2 at work): it hops and squashes on its spot
// while a glowing ring runs round its shore, gold when its trait helped it, grey when it cost it.
// Wraps the island; restarts whenever `pulseKey` changes.

const GLOW = { gain: '#ffc94a', loss: '#6b7180' } as const;
/** Gold adds light (it glows); grey is laid over the sea as is, a dull band rather than a light. */
const BLEND = { gain: AdditiveBlending, loss: NormalBlending } as const;
const STRENGTH = { gain: 1, loss: 0.55 } as const;

export interface IslandPulseProps {
  readonly angle: number;
  /** Changes for every new pulse; null for no pulse. */
  readonly pulseKey: string | null;
  readonly tone: 'gain' | 'loss';
  readonly children: ReactNode;
}

export function IslandPulse({ angle, pulseKey, tone, children }: IslandPulseProps) {
  const body = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const since = useRef<{ key: string; at: number } | null>(null);
  const home = seatPosition(angle);
  useFrame(({ clock }) => {
    const b = body.current;
    const r = ring.current;
    if (!b || !r) return;
    if (pulseKey !== null && since.current?.key !== pulseKey) since.current = { key: pulseKey, at: clock.elapsedTime };
    const t = pulseKey !== null && since.current ? clock.elapsedTime - since.current.at : -1;
    const f = pulseFrame(t);
    b.position.y = f.hop;
    b.scale.set(f.wide, f.tall, f.wide);
    r.visible = f.glow > 0;
    r.scale.setScalar(f.ring);
    (r.material as MeshBasicMaterial).opacity = f.glow * STRENGTH[tone];
  });
  return (
    <group position={home}>
      <group ref={body}>
        <group position={[-home[0], -home[1], -home[2]]}>{children}</group>
      </group>
      <mesh ref={ring} position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={5}>
        <ringGeometry args={[PLAYER_ISLAND_RADIUS + 0.6, PLAYER_ISLAND_RADIUS + 2.2, 64]} />
        <meshBasicMaterial key={tone} color={GLOW[tone]} transparent blending={BLEND[tone]} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
    </group>
  );
}
