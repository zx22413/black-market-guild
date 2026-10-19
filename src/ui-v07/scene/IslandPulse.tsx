import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AdditiveBlending, DoubleSide, NormalBlending, SpriteMaterial, type Group, type Mesh, type MeshBasicMaterial, type Sprite } from 'three';
import { SPARKLES } from '../../ui/scene/GoldRush';
import { PLAYER_ISLAND_RADIUS, seatPosition } from '../../ui/scene/layout';
import { DOME, DUST, dustMote, pulseFrame } from './pulseMath';

// An island that just counted (docs/game-design.md §11.2 at work): it hops and squashes on its spot
// while light covers the whole island, gold dust rises off it (the black market rush's glitter) and
// a glowing ring runs round its shore. Gold when its trait helped it, grey when it cost it. Wraps
// the island; restarts whenever `pulseKey` changes.

const GLOW = { gain: '#ffc94a', loss: '#6b7180' } as const;
const DUST_COLOR = { gain: '#ffd25c', loss: '#9aa0ad' } as const;
/** Gold adds light (it glows); grey is laid over the sea as is, a dull band rather than a light. */
const BLEND = { gain: AdditiveBlending, loss: NormalBlending } as const;
const STRENGTH = { gain: 1, loss: 0.55 } as const;
/** The light over the island: a low dome a little wider than the island. */
const DOME_RADIUS = PLAYER_ISLAND_RADIUS + 1.5;
const DOME_FLAT = 0.5;

export interface IslandPulseProps {
  readonly angle: number;
  /** Changes for every new pulse; null for no pulse. */
  readonly pulseKey: string | null;
  readonly tone: 'gain' | 'loss';
  readonly children: ReactNode;
}

/** The dust rising off the island, while a pulse plays. */
function Dust({ tone, since }: { readonly tone: 'gain' | 'loss'; readonly since: () => number }) {
  const textures = useTexture(SPARKLES);
  const materials = useMemo(
    () => Array.from({ length: DUST.motes }, (_, i) => new SpriteMaterial({ color: DUST_COLOR[tone], alphaMap: textures[i % textures.length] ?? null, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })),
    [textures, tone],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const sprites = useRef<(Sprite | null)[]>([]);
  useFrame(() => {
    const t = since();
    materials.forEach((material, i) => {
      const sprite = sprites.current[i];
      if (!sprite) return;
      const mote = t < 0 ? null : dustMote(i, t, PLAYER_ISLAND_RADIUS);
      sprite.visible = mote !== null;
      if (!mote) return;
      sprite.position.set(mote.x, mote.y, mote.z);
      sprite.scale.setScalar(mote.size);
      material.opacity = mote.opacity * STRENGTH[tone];
    });
  });
  return (
    <>
      {materials.map((material, i) => (
        <sprite
          key={i}
          ref={(s) => {
            sprites.current[i] = s;
          }}
          material={material}
          visible={false}
        />
      ))}
    </>
  );
}

export function IslandPulse({ angle, pulseKey, tone, children }: IslandPulseProps) {
  const body = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const dome = useRef<Mesh>(null);
  const started = useRef<{ key: string; at: number } | null>(null);
  const clockNow = useRef(0);
  const home = seatPosition(angle);
  const since = () => (pulseKey !== null && started.current?.key === pulseKey ? clockNow.current - started.current.at : -1);
  useFrame(({ clock }) => {
    clockNow.current = clock.elapsedTime;
    const b = body.current;
    const r = ring.current;
    const d = dome.current;
    if (!b || !r || !d) return;
    if (pulseKey !== null && started.current?.key !== pulseKey) started.current = { key: pulseKey, at: clock.elapsedTime };
    const f = pulseFrame(since());
    b.position.y = f.hop;
    b.scale.set(f.wide, f.tall, f.wide);
    r.visible = f.glow > 0;
    r.scale.setScalar(f.ring);
    (r.material as MeshBasicMaterial).opacity = f.glow * STRENGTH[tone];
    // The light over the island rides the hop with it.
    d.visible = f.glow > 0;
    d.position.y = f.hop;
    (d.material as MeshBasicMaterial).opacity = f.glow * DOME * STRENGTH[tone];
  });
  return (
    <group position={home}>
      <group ref={body}>
        <group position={[-home[0], -home[1], -home[2]]}>{children}</group>
      </group>
      <mesh ref={dome} scale={[1, DOME_FLAT, 1]} visible={false} renderOrder={6}>
        <sphereGeometry args={[DOME_RADIUS, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial key={tone} color={GLOW[tone]} transparent blending={BLEND[tone]} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh ref={ring} position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={5}>
        <ringGeometry args={[PLAYER_ISLAND_RADIUS + 0.6, PLAYER_ISLAND_RADIUS + 2.2, 64]} />
        <meshBasicMaterial key={tone} color={GLOW[tone]} transparent blending={BLEND[tone]} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
      {/* Its own boundary: the sparkle sprites loading the first time must not blank the table. */}
      {pulseKey !== null && (
        <Suspense fallback={null}>
          <Dust key={tone} tone={tone} since={since} />
        </Suspense>
      )}
    </group>
  );
}
