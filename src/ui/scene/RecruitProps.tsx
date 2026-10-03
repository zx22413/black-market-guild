import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { MeshBasicMaterial, MeshStandardMaterial, SpriteMaterial, type BufferGeometry, type Group, type Mesh, type Sprite } from 'three';
import type { PlayerId } from '../../game';
import type { RecruitCue } from '../table/recruitShow';
import { geometryFromParts } from './buildings/Building';
import type { KitPart } from './buildings/kit';
import type { Vec3 } from './layout';
import { HANDS_A, MEDAL_B, SCROLL_ROLL_X, envelopeHalf, scrollPaper, scrollRoll, sleeveA, type Side } from './props/recruitProps';
import {
  bob,
  envelopeMotion,
  handshakeMotion,
  medalDrop,
  scrollHold,
  scrollIntro,
  scrollTear,
  scrollWithdraw,
  type ScrollPose,
  type TearPose,
} from './recruitMotion';
import { SPARKLES } from './sparkles';
import type { SceneSeat } from './tableModel';

/** Props are modelled lying flat; this tilts their face up toward the table camera. */
export const PROP_TILT = (50 * Math.PI) / 180;
/** Size of the props over an island, and how high above the sea they float. */
export const PROP_SCALE = 3.8;
export const PROP_HEIGHT = 9.5;
/** The medal sits small on the open scroll. */
const MEDAL_ON_SCROLL = 0.42;
/** A rolled-up scroll: the two rolls side by side in the middle. */
const ROLLED_X = 0.18;
/** World down, in the tilted prop's own axes: where a falling medal goes. */
const DOWN: Vec3 = [0, -Math.cos(PROP_TILT), Math.sin(PROP_TILT)];
/** Radius of the gold ring a handshake spreads over the island, in world units. */
const RING_RADIUS = 11;

// ── Shared geometry and materials ──

const geometries = new Map<readonly KitPart[], BufferGeometry>();
function geometryOf(parts: readonly KitPart[]): BufferGeometry {
  const cached = geometries.get(parts);
  if (cached) return cached;
  const geometry = geometryFromParts(parts);
  geometries.set(parts, geometry);
  return geometry;
}

const PAPER = { [-1]: scrollPaper(-1), [1]: scrollPaper(1) } as const;
const ROLL = scrollRoll();
const ENVELOPE = { [-1]: envelopeHalf(-1), [1]: envelopeHalf(1) } as const;
const SLEEVES = { [-1]: sleeveA(-1), [1]: sleeveA(1) } as const;
const SIDES = [-1, 1] as const;

/** Materials a prop owns, so it can fade without touching any other prop. */
function useFadeMaterials(tints: readonly string[] = []) {
  const key = tints.join(',');
  const materials = useMemo(() => {
    const make = (color?: string) =>
      new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, transparent: true, ...(color ? { color } : {}) });
    return { plain: make(), tinted: key ? key.split(',').map((c) => make(c)) : [] };
  }, [key]);
  useEffect(() => () => [materials.plain, ...materials.tinted].forEach((m) => m.dispose()), [materials]);
  const setOpacity = (opacity: number): void => {
    for (const m of [materials.plain, ...materials.tinted]) {
      m.opacity = opacity;
      // Fully opaque props render in the opaque pass, so they sort correctly with the island.
      m.depthWrite = opacity > 0.99;
    }
  };
  return { ...materials, setOpacity };
}

function PartsMesh({ parts, material }: { readonly parts: readonly KitPart[]; readonly material: MeshStandardMaterial }) {
  return <mesh geometry={geometryOf(parts)} material={material} castShadow dispose={null} />;
}

/**
 * Milliseconds since the prop mounted, minus its delay; or a fixed frame for the dev preview.
 * Wall-clock time, not summed frame times: the labels over the islands are CSS animations on the
 * wall clock, and a slow frame rate must not leave the props lagging behind them.
 */
function useCueClock(at: number, freezeAt: number | undefined) {
  const [mounted] = useState(() => performance.now());
  return (): number => freezeAt ?? performance.now() - mounted - at;
}

/** Offset and turn of a torn half: the halves drift apart sideways, drop a little and twist. */
function halfPose(side: Side, apart: number): { position: Vec3; rotation: Vec3 } {
  return {
    position: [side * apart * 0.8, -apart * 0.2, apart * 0.6],
    rotation: [0, -side * apart * 0.6, side * apart * 0.45],
  };
}

interface CueTiming {
  /** Milliseconds before the prop starts, and how long it plays. */
  readonly at?: number;
  readonly duration?: number;
  /** Dev preview only: hold the prop at this many milliseconds into its run. */
  readonly freezeAt?: number;
}

// ── Scroll ──

export type ScrollMode = 'intro' | 'hold' | 'withdraw' | 'tear';

interface ScrollProps extends CueTiming {
  readonly position: Vec3;
  readonly mode: ScrollMode;
}

/**
 * A recruiter's open call: a scroll that pops up rolled and unrolls to show its medal ('intro'),
 * stays up through the results ('hold'), rolls back up and fades when withdrawn ('withdraw'), or
 * shakes and tears in two, dropping the medal, when nobody was picked ('tear').
 */
export function RecruitScroll({ position, mode, at = 0, duration = 0, freezeAt }: ScrollProps) {
  const fade = useFadeMaterials();
  const medalFade = useFadeMaterials();
  const root = useRef<Group>(null);
  const halves = useRef<(Group | null)[]>([]);
  const papers = useRef<(Group | null)[]>([]);
  const rolls = useRef<(Group | null)[]>([]);
  const medal = useRef<Group>(null);
  const clock = useCueClock(at, freezeAt);

  useFrame(({ clock: scene }) => {
    const ms = clock();
    const group = root.current;
    if (!group) return;
    const timed = mode !== 'intro';
    group.visible = ms >= 0 && (!timed || ms <= duration);
    if (!group.visible) return;

    let pose: ScrollPose = { scale: 1, unroll: 1, medal: 1, opacity: 1, lift: 0 };
    let torn: TearPose = { shake: 0, apart: 0, opacity: 1 };
    let drop = { drop: 0, opacity: 1 };
    if (mode === 'intro') pose = scrollIntro(ms);
    if (mode === 'hold') pose = scrollHold(ms, duration);
    if (mode === 'withdraw') pose = scrollWithdraw(ms, duration);
    if (mode === 'tear') {
      torn = scrollTear(ms, duration);
      drop = medalDrop(ms, duration);
    }

    group.position.set(position[0] + torn.shake * PROP_SCALE, position[1] + bob(scene.elapsedTime) + pose.lift * PROP_SCALE, position[2]);
    group.scale.setScalar(Math.max(pose.scale, 0.001) * PROP_SCALE);
    fade.setOpacity(pose.opacity * torn.opacity);
    medalFade.setOpacity(pose.opacity * drop.opacity);
    SIDES.forEach((side, i) => {
      const half = halfPose(side, torn.apart);
      halves.current[i]?.position.set(...half.position);
      halves.current[i]?.rotation.set(...half.rotation);
      papers.current[i]?.scale.set(Math.max(pose.unroll, 0.001), 1, 1);
      rolls.current[i]?.position.set(side * (ROLLED_X + (SCROLL_ROLL_X - ROLLED_X) * pose.unroll), 0, 0);
    });
    const m = medal.current;
    if (m) {
      m.scale.setScalar(Math.max(pose.medal, 0.001) * MEDAL_ON_SCROLL);
      m.position.set(DOWN[0] * drop.drop, 0.06 + DOWN[1] * drop.drop, 0.02 + DOWN[2] * drop.drop);
      m.rotation.set(0, 0, drop.drop * 0.6);
    }
  });

  return (
    <group ref={root} visible={false} rotation={[PROP_TILT, 0, 0]}>
      {SIDES.map((side, i) => (
        <group
          key={side}
          ref={(g) => {
            halves.current[i] = g;
          }}
        >
          <group
            ref={(g) => {
              papers.current[i] = g;
            }}
          >
            <PartsMesh parts={PAPER[side]} material={fade.plain} />
          </group>
          <group
            ref={(g) => {
              rolls.current[i] = g;
            }}
          >
            <PartsMesh parts={ROLL} material={fade.plain} />
          </group>
        </group>
      ))}
      <group ref={medal}>
        <PartsMesh parts={MEDAL_B} material={medalFade.plain} />
      </group>
    </group>
  );
}

// ── Envelope ──

/** An applicant's letter turned down: pops up, shakes, then rips in two and fades. */
export function RecruitEnvelope({ position, at = 0, duration = 0, freezeAt }: CueTiming & { readonly position: Vec3 }) {
  const fade = useFadeMaterials();
  const root = useRef<Group>(null);
  const halves = useRef<(Group | null)[]>([]);
  const clock = useCueClock(at, freezeAt);

  useFrame(({ clock: scene }) => {
    const ms = clock();
    const group = root.current;
    if (!group) return;
    group.visible = ms >= 0 && ms <= duration;
    if (!group.visible) return;
    const motion = envelopeMotion(ms, duration);
    group.position.set(position[0] + motion.shake * PROP_SCALE, position[1] + bob(scene.elapsedTime, 1), position[2]);
    group.scale.setScalar(Math.max(motion.scale, 0.001) * PROP_SCALE);
    fade.setOpacity(motion.opacity);
    SIDES.forEach((side, i) => {
      const half = halfPose(side, motion.apart);
      halves.current[i]?.position.set(...half.position);
      halves.current[i]?.rotation.set(...half.rotation);
    });
  });

  return (
    <group ref={root} visible={false} rotation={[PROP_TILT, 0, 0]}>
      {SIDES.map((side, i) => (
        <group
          key={side}
          ref={(g) => {
            halves.current[i] = g;
          }}
        >
          <PartsMesh parts={ENVELOPE[side]} material={fade.plain} />
        </group>
      ))}
    </group>
  );
}

// ── Handshake ──

interface HandshakeProps extends CueTiming {
  readonly position: Vec3;
  /** Where the gold ring spreads: the island's grass, under the handshake. */
  readonly ground: Vec3;
  /** The two guilds that teamed up: left cuff, right cuff. */
  readonly colors: readonly [string, string];
}

const SPARK_COUNT = 8;

/** A pairing: the handshake (cuffs in both guilds' colors) springs up, a gold ring spreads, sparks fly. */
export function RecruitHandshake({ position, ground, colors, at = 0, duration = 0, freezeAt }: HandshakeProps) {
  const fade = useFadeMaterials(colors);
  const textures = useTexture(SPARKLES);
  const sparkMaterials = useMemo(
    () => Array.from({ length: SPARK_COUNT }, (_, i) => new SpriteMaterial({ color: '#ffd25c', alphaMap: textures[i % textures.length] ?? null, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })),
    [textures],
  );
  const ringMaterial = useMemo(() => new MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), []);
  useEffect(() => () => [...sparkMaterials, ringMaterial].forEach((m) => m.dispose()), [sparkMaterials, ringMaterial]);
  const root = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const sparks = useRef<(Sprite | null)[]>([]);
  const clock = useCueClock(at, freezeAt);

  useFrame(({ clock: scene }) => {
    const ms = clock();
    const group = root.current;
    if (!group) return;
    const visible = ms >= 0 && ms <= duration;
    group.visible = visible;
    if (ring.current) ring.current.visible = visible;
    if (!visible) {
      sparkMaterials.forEach((m) => (m.opacity = 0));
      return;
    }
    const motion = handshakeMotion(ms, duration);
    group.position.set(position[0], position[1] + bob(scene.elapsedTime, 2), position[2]);
    group.scale.setScalar(Math.max(motion.scale, 0.001) * PROP_SCALE);
    fade.setOpacity(motion.opacity);
    ring.current?.scale.setScalar(Math.max(motion.ring, 0.001) * RING_RADIUS);
    ringMaterial.opacity = motion.ringOpacity;
    // Sparks fly out of the grip as it pops, then fade.
    const k = Math.min(1, Math.max(0, ms / 900));
    sparks.current.forEach((sprite, i) => {
      if (!sprite) return;
      const a = (i / SPARK_COUNT) * Math.PI * 2 + 0.3;
      const reach = 1.5 + k * 6;
      sprite.position.set(position[0] + Math.cos(a) * reach, position[1] + Math.sin(a) * reach * 0.7 + k * 2, position[2] + 0.5);
      sprite.scale.setScalar(2.4 * (1 - k * 0.5));
      sparkMaterials[i]!.opacity = k < 1 ? 1 - k * k : 0;
      sparkMaterials[i]!.rotation = a + k * 3;
    });
  });

  return (
    <>
      <group ref={root} visible={false} rotation={[PROP_TILT, 0, 0]}>
        <PartsMesh parts={HANDS_A} material={fade.plain} />
        <PartsMesh parts={SLEEVES[-1]} material={fade.tinted[0]!} />
        <PartsMesh parts={SLEEVES[1]} material={fade.tinted[1]!} />
      </group>
      <mesh ref={ring} visible={false} position={ground} rotation={[-Math.PI / 2, 0, 0]} material={ringMaterial}>
        <ringGeometry args={[0.8, 1, 48]} />
      </mesh>
      {sparkMaterials.map((material, i) => (
        <sprite
          key={i}
          ref={(s) => {
            sparks.current[i] = s;
          }}
          material={material}
        />
      ))}
    </>
  );
}

// ── Stage: the props of the recruitment show, over the islands ──

interface RecruitStageProps {
  readonly cues: readonly RecruitCue[];
  readonly seats: readonly SceneSeat[];
  /** Where each seat's props float (same order as `seats`). */
  readonly points: readonly Vec3[];
  /** The middle of each seat's grass, for the handshake's ring. */
  readonly grounds: readonly Vec3[];
  /** Open recruitments still stand on the table (the results are not out yet). */
  readonly standing: boolean;
}

/** Draws every recruitment prop: standing scrolls from the table state, the rest from the show's cues. */
export function RecruitStage({ cues, seats, points, grounds, standing }: RecruitStageProps) {
  const seatIndex = (id: PlayerId | undefined): number => seats.findIndex((s) => s.id === id);
  const colorOf = (id: PlayerId | undefined): string => seats[seatIndex(id)]?.color ?? '#b08850';
  return (
    <Suspense fallback={null}>
      {standing &&
        seats.map((seat, i) =>
          seat.recruiting === 'open' && points[i] ? <RecruitScroll key={`stand-${seat.id}`} position={points[i]!} mode="intro" /> : null,
        )}
      {cues.map((cue) => {
        const i = seatIndex(cue.player);
        const position = points[i];
        if (!position) return null;
        const timing = { at: cue.at, duration: cue.duration };
        switch (cue.kind) {
          case 'parchment-hold':
            return cue.duration > 0 ? <RecruitScroll key={cue.key} position={position} mode="hold" {...timing} /> : null;
          case 'parchment-withdraw':
            return <RecruitScroll key={cue.key} position={position} mode="withdraw" {...timing} />;
          case 'parchment-tear':
            return <RecruitScroll key={cue.key} position={position} mode="tear" {...timing} />;
          case 'envelope-tear':
            return <RecruitEnvelope key={cue.key} position={position} {...timing} />;
          case 'handshake': {
            const other = cue.recruiter === cue.player ? cue.partner : cue.player;
            return (
              <RecruitHandshake key={cue.key} position={position} ground={grounds[i]!} colors={[colorOf(cue.recruiter), colorOf(other)]} {...timing} />
            );
          }
          case 'pigeon':
            // Pigeons fly between islands (PigeonFlight), not over one.
            return null;
        }
      })}
    </Suspense>
  );
}
