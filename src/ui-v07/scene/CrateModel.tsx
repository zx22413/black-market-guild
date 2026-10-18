import { useFrame, useLoader } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { SRGBColorSpace, TextureLoader, type MeshStandardMaterial } from 'three';
import type { GoodId } from '../../v07/game';
import { goodIconUrl } from '../table3d/GoodIcon';

// One crate of goods, low-poly like the rest of the table: a plank body, darker corner posts and
// two straps, and on the lid a dark disc ringed in the goods' color with the goods' icon (the same
// icon the interface uses), so a stack reads from the high table camera without any text.

export const CRATE_SIZE = 1.7;
export const GOOD_COLORS: Readonly<Record<GoodId, string>> = { wood: '#c08a4e', iron: '#9fb0bd', spice: '#e2823a', arms: '#d35d6e' };

const PLANK = '#c79a5b';
const TIMBER = '#8a5a2b';
const TARP = '#8a6a45';
const SPOILED = '#4a3a2a';

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
}

export function CrateModel({ good, tarp = false, faded = false, glow = false, spoiled = false }: CrateModelProps) {
  const body = useGoldBreath(glow);
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
      <mesh castShadow>
        <boxGeometry args={[CRATE_SIZE, CRATE_SIZE, CRATE_SIZE]} />
        <meshStandardMaterial ref={body} color={plank} emissive="#ffc23d" emissiveIntensity={0} {...props} />
      </mesh>
      {([-1, 1] as const).flatMap((x) =>
        ([-1, 1] as const).map((z) => (
          <mesh key={`${x}${z}`} position={[x * edge, 0, z * edge]} castShadow>
            <boxGeometry args={[0.22, CRATE_SIZE + 0.04, 0.22]} />
            <meshStandardMaterial color={timber} {...props} />
          </mesh>
        )),
      )}
      {([-0.46, 0.46] as const).map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[CRATE_SIZE + 0.06, 0.18, CRATE_SIZE + 0.06]} />
          <meshStandardMaterial color={timber} {...props} />
        </mesh>
      ))}
      {!tarp && !spoiled && (
        <group position={[0, half + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <circleGeometry args={[0.62, 20]} />
            <meshBasicMaterial color="#fbf3dc" transparent={faded} opacity={opacity} />
          </mesh>
          <mesh position={[0, 0, 0.005]}>
            <ringGeometry args={[0.58, 0.7, 20]} />
            <meshBasicMaterial color={GOOD_COLORS[good]} transparent={faded} opacity={opacity} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.86, 0.86]} />
            <meshBasicMaterial map={icon} transparent opacity={opacity} />
          </mesh>
        </group>
      )}
    </group>
  );
}
