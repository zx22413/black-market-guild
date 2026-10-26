import { useFrame, useLoader } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { BoxGeometry, CircleGeometry, PlaneGeometry, RingGeometry, SRGBColorSpace, TextureLoader, type MeshStandardMaterial } from 'three';
import type { GoodId } from '../../v07/game';
import { createGoldGlow, goldGlowPatch } from '../../ui/scene/goldGlow';
import { goodIconUrl } from '../table3d/GoodIcon';
import { mintGlow } from './mintMath';

// One crate of goods, low-poly like the rest of the table: a plank body, darker corner posts and
// two straps, and on the lid a dark disc ringed in the goods' color with the goods' icon (the same
// icon the interface uses), so a stack reads from the high table camera without any text.

export const CRATE_SIZE = 1.7;
export const GOOD_COLORS: Readonly<Record<GoodId, string>> = { wood: '#c08a4e', iron: '#9fb0bd', spice: '#e2823a', arms: '#d35d6e' };

const PLANK = '#c79a5b';
const TIMBER = '#8a5a2b';
const TARP = '#8a6a45';
const SPOILED = '#4a3a2a';

// Every crate has the same shape, so the shapes are built once and shared (a table of crates
// would otherwise hold ten geometries each); only the materials differ from crate to crate. They
// are passed as props, which react-three-fiber never disposes, so a crate leaving takes only its materials.
const BODY = new BoxGeometry(CRATE_SIZE, CRATE_SIZE, CRATE_SIZE);
const POST = new BoxGeometry(0.22, CRATE_SIZE + 0.04, 0.22);
const STRAP = new BoxGeometry(CRATE_SIZE + 0.06, 0.18, CRATE_SIZE + 0.06);
const DISC = new CircleGeometry(0.62, 20);
const RIM = new RingGeometry(0.58, 0.7, 20);
const ICON = new PlaneGeometry(0.86, 0.86);

/** Gold breathing glow on a crate that still waits for the player. */
function useGoldBreath(on: boolean) {
  const material = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const m = material.current;
    if (!m) return;
    m.emissiveIntensity = on ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3)) : 0;
  });
  return material;
}

export interface CrateModelProps {
  readonly good: GoodId;
  /** Covered with a tarp: what is inside is not shown (other players' ships, §4). */
  readonly tarp?: boolean;
  /** Faded: used up by the building being chosen. */
  readonly faded?: boolean;
  readonly glow?: boolean;
  /** Darkened (spoiled spice). */
  readonly spoiled?: boolean;
  /** Made this round: turns to molten gold when it appears, then cools to wood (`mintMath`). */
  readonly minted?: boolean;
}

/** The gold of a new crate, driven from the moment it appears; null for an ordinary crate. */
function useMint(minted: boolean) {
  // Decided once: a crate that was new when it appeared keeps its gold shader (cooled to 0 later).
  const [on] = useState(minted);
  const gold = useMemo(() => (on ? createGoldGlow() : null), [on]);
  const patch = useMemo(() => (gold ? goldGlowPatch(gold) : null), [gold]);
  const born = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (!gold) return;
    born.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - born.current;
    gold.uGlow.value = mintGlow(t);
    gold.uTime.value = t;
  });
  return patch ? { onBeforeCompile: patch, customProgramCacheKey: () => 'gold-glow' } : {};
}

export function CrateModel({ good, tarp = false, faded = false, glow = false, spoiled = false, minted = false }: CrateModelProps) {
  const body = useGoldBreath(glow);
  const mint = useMint(minted);
  const icon = useLoader(TextureLoader, goodIconUrl(good));
  useMemo(() => {
    icon.colorSpace = SRGBColorSpace;
  }, [icon]);
  const half = CRATE_SIZE / 2;
  const edge = half - 0.09;
  const opacity = faded ? 0.28 : 1;
  const props = { transparent: faded, opacity, flatShading: true } as const;
  const plank = spoiled ? SPOILED : tarp ? TARP : PLANK;
  const timber = spoiled ? '#3a2c1e' : tarp ? '#6e5436' : TIMBER;
  return (
    <group>
      <mesh geometry={BODY} castShadow>
        <meshStandardMaterial ref={body} color={plank} emissive="#ffc23d" emissiveIntensity={0} {...props} {...mint} />
      </mesh>
      {([-1, 1] as const).flatMap((x) =>
        ([-1, 1] as const).map((z) => (
          <mesh key={`${x}${z}`} geometry={POST} position={[x * edge, 0, z * edge]} castShadow>
            <meshStandardMaterial color={timber} {...props} {...mint} />
          </mesh>
        )),
      )}
      {([-0.46, 0.46] as const).map((y) => (
        <mesh key={y} geometry={STRAP} position={[0, y, 0]}>
          <meshStandardMaterial color={timber} {...props} {...mint} />
        </mesh>
      ))}
      {!tarp && !spoiled && (
        <group position={[0, half + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh geometry={DISC}>
            <meshBasicMaterial color="#fbf3dc" transparent={faded} opacity={opacity} />
          </mesh>
          <mesh geometry={RIM} position={[0, 0, 0.005]}>
            <meshBasicMaterial color={GOOD_COLORS[good]} transparent={faded} opacity={opacity} />
          </mesh>
          <mesh geometry={ICON} position={[0, 0, 0.01]}>
            <meshBasicMaterial map={icon} transparent opacity={opacity} />
          </mesh>
        </group>
      )}
    </group>
  );
}
