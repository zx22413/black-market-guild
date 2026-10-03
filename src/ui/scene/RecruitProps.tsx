import { useMemo } from 'react';
import type { BufferGeometry } from 'three';
import type { KitPart } from './buildings/kit';
import { geometryFromParts } from './buildings/Building';
import type { Vec3 } from './layout';
import { HANDS_A, MEDAL_B, envelopeHalf, ribbonB, scrollHalf, sleeveA, type Side } from './props/recruitProps';

/** Props are modelled lying flat; this tilts their face up toward the table camera. */
export const PROP_TILT = (50 * Math.PI) / 180;

/** Geometry is built once per part list and shared by every prop that uses it. */
const cache = new Map<readonly KitPart[], BufferGeometry>();
function geometryOf(parts: readonly KitPart[]): BufferGeometry {
  const cached = cache.get(parts);
  if (cached) return cached;
  const geometry = geometryFromParts(parts);
  cache.set(parts, geometry);
  return geometry;
}

const SCROLL_HALVES = { [-1]: scrollHalf(-1), [1]: scrollHalf(1) } as const;
const ENVELOPE_HALVES = { [-1]: envelopeHalf(-1), [1]: envelopeHalf(1) } as const;
const SLEEVES = { [-1]: sleeveA(-1), [1]: sleeveA(1) } as const;
const RIBBONS = { [-1]: ribbonB(-1), [1]: ribbonB(1) } as const;

/** One part list as a mesh; `tint` colors the white parts of guild-colored pieces. */
function PartsMesh({ parts, tint }: { readonly parts: readonly KitPart[]; readonly tint?: string }) {
  const geometry = useMemo(() => geometryOf(parts), [parts]);
  return (
    <mesh geometry={geometry} castShadow dispose={null}>
      <meshStandardMaterial vertexColors roughness={0.8} {...(tint ? { color: tint } : {})} />
    </mesh>
  );
}

interface PropPlacement {
  readonly position: Vec3;
  readonly scale: number;
}

interface TornProps extends PropPlacement {
  /** 0 = whole, 1 = the halves fully pulled apart. */
  readonly apart?: number;
}

/** Offset and turn of a torn half: the halves drift apart sideways, drop a little and twist. */
function halfPose(side: Side, apart: number): { position: Vec3; rotation: Vec3 } {
  return {
    position: [side * apart * 0.7, -apart * 0.15, apart * 0.5],
    rotation: [0, -side * apart * 0.5, side * apart * 0.35],
  };
}

/** The recruiter's open call: a scroll with a handshake on it, torn in two when it fails. */
export function ScrollProp({ position, scale, apart = 0, emblem }: TornProps & { readonly emblem?: 'A' | 'B' }) {
  return (
    <group position={position} rotation={[PROP_TILT, 0, 0]} scale={scale}>
      {([-1, 1] as const).map((side) => {
        const pose = halfPose(side, apart);
        return (
          <group key={side} position={pose.position} rotation={pose.rotation}>
            <PartsMesh parts={SCROLL_HALVES[side]} />
            {/* The emblem goes with the right half when the scroll tears. */}
            {side === 1 && emblem && (
              <group position={[0, 0.06, 0.02]} scale={emblem === 'A' ? 0.42 : 0.4}>
                {emblem === 'A' ? <HandshakeAParts colors={['#8a5a2b', '#8a5a2b']} /> : <PartsMesh parts={MEDAL_B} />}
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** An applicant's letter: sealed envelope, torn in two when the application is turned down. */
export function EnvelopeProp({ position, scale, apart = 0 }: TornProps) {
  return (
    <group position={position} rotation={[PROP_TILT, 0, 0]} scale={scale}>
      {([-1, 1] as const).map((side) => {
        const pose = halfPose(side, apart);
        return (
          <group key={side} position={pose.position} rotation={pose.rotation}>
            <PartsMesh parts={ENVELOPE_HALVES[side]} />
          </group>
        );
      })}
    </group>
  );
}

/** Take A: sculpted hands; the left sleeve wears one guild's color, the right sleeve the other's. */
function HandshakeAParts({ colors }: { readonly colors: readonly [string, string] }) {
  return (
    <>
      <PartsMesh parts={HANDS_A} />
      <PartsMesh parts={SLEEVES[-1]} tint={colors[0]} />
      <PartsMesh parts={SLEEVES[1]} tint={colors[1]} />
    </>
  );
}

interface HandshakeProps extends PropPlacement {
  /** The two guilds that teamed up, left and right. */
  readonly colors: readonly [string, string];
}

export function HandshakeA({ position, scale, colors }: HandshakeProps) {
  return (
    <group position={position} rotation={[PROP_TILT, 0, 0]} scale={scale}>
      <HandshakeAParts colors={colors} />
    </group>
  );
}

/** Take B: a gold medal with the handshake in relief and a ribbon in each guild's color. */
export function HandshakeB({ position, scale, colors }: HandshakeProps) {
  return (
    <group position={position} rotation={[PROP_TILT, 0, 0]} scale={scale}>
      <PartsMesh parts={MEDAL_B} />
      <PartsMesh parts={RIBBONS[-1]} tint={colors[0]} />
      <PartsMesh parts={RIBBONS[1]} tint={colors[1]} />
    </group>
  );
}
