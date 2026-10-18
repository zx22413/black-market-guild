import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, ConeGeometry, IcosahedronGeometry, MeshBasicMaterial, SpriteMaterial, type Group, type Mesh, type Sprite } from 'three';
import { useLiveFrame } from '../liveFrame';
import { glowTexture } from '../Night';
import { geometryFromParts } from './Building';
import type { LandmarkSalute } from './islands/design';
import { flashLevel, gunMotion, puffState, shotAge, SHOT } from './islands/salute';
import { PUFF_BALL, STEAM_SMOKE, smokeBallMaterials } from './smokeBall';

const FLASH_COLOR = '#ffd263';
const FLASH_GLOW = '#ff9a45';
/** The muzzle flash at its brightest, in the design's units at a shot of size 1: the tongue of fire's length and girth, the core's radius and the glow's. */
const FLASH = { length: 0.5, girth: 0.13, core: 0.08, glow: 1.3 } as const;

/** A tongue of fire along +x from the origin, its base at the muzzle. */
const TONGUE = new ConeGeometry(1, 1, 7).translate(0, 0.5, 0).rotateZ(-Math.PI / 2);
const CORE = new IcosahedronGeometry(1, 0);

/**
 * A fort's guns firing a salute round the bastions, one after another, in cartoon style: each gun
 * squashes, springs out long as it fires and wobbles back, kicked back by the recoil; a tongue of fire
 * and a glow flare at the muzzle and a burst of white powder smoke hangs, swells, rises and thins away.
 */
export function Salute({ salute }: { readonly salute: LandmarkSalute }) {
  const gun = useMemo(() => geometryFromParts(salute.gun), [salute]);
  const count = salute.guns.length * SHOT.puffs;
  const materials = useMemo(() => smokeBallMaterials(count, STEAM_SMOKE), [count]);
  const [fire, glow] = useMemo(
    () => [
      new MeshBasicMaterial({ color: FLASH_COLOR, toneMapped: false, transparent: true }),
      new SpriteMaterial({ map: glowTexture(), color: FLASH_GLOW, blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }),
    ],
    [],
  );
  useEffect(
    () => () => {
      materials.forEach((m) => m.dispose());
      fire.dispose();
      glow.dispose();
    },
    [materials, fire, glow],
  );
  const bodies = useRef<(Group | null)[]>([]);
  const flashes = useRef<(Group | null)[]>([]);
  const tongues = useRef<(Mesh | null)[]>([]);
  const cores = useRef<(Mesh | null)[]>([]);
  const glows = useRef<(Sprite | null)[]>([]);
  const balls = useRef<(Mesh | null)[]>([]);
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const { size, muzzle: [mx, my] } = salute;
    salute.guns.forEach(({ at: [x, y, z], toward: [tx, , tz] }, g) => {
      const { along, across, recoil } = gunMotion(salute, g, t);
      bodies.current[g]?.position.set(-recoil * size, 0, 0);
      bodies.current[g]?.scale.set(along, across, across);
      const age = shotAge(salute, g, t);
      const level = age === null ? 0 : flashLevel(age);
      const flash = flashes.current[g];
      if (flash) {
        flash.visible = level > 0;
        flash.position.set(mx * along - recoil * size, my * across, 0);
      }
      tongues.current[g]?.scale.set(FLASH.length * size * (0.5 + 0.5 * level), FLASH.girth * size * level, FLASH.girth * size * level);
      cores.current[g]?.scale.setScalar(FLASH.core * size * (0.6 + 0.6 * level));
      glows.current[g]?.scale.setScalar(FLASH.glow * size * level);
      for (let j = 0; j < SHOT.puffs; j++) {
        const ball = balls.current[g * SHOT.puffs + j];
        if (!ball) continue;
        ball.visible = age !== null;
        if (age === null) continue;
        const puff = puffState(j, age);
        const out = mx + puff.out * size;
        // Out along the gun from its muzzle, a little aside (across it) and up.
        ball.position.set(x + tx * out - tz * puff.aside * size, y + my + puff.up * size, z + tz * out + tx * puff.aside * size);
        ball.scale.setScalar(puff.radius * size);
        ball.rotation.set(j, g + j * 2, 0);
        materials[g * SHOT.puffs + j]!.opacity = puff.opacity;
      }
    });
  });
  return (
    <>
      {salute.guns.map(({ at, toward }, g) => (
        <group key={g} position={[...at]} rotation={[0, Math.atan2(-toward[2], toward[0]), 0]}>
          <group ref={(b) => void (bodies.current[g] = b)}>
            <mesh geometry={gun} castShadow receiveShadow dispose={null}>
              <meshStandardMaterial vertexColors roughness={0.8} />
            </mesh>
          </group>
          <group ref={(f) => void (flashes.current[g] = f)} position={[...salute.muzzle]} visible={false}>
            <mesh ref={(m) => void (tongues.current[g] = m)} geometry={TONGUE} material={fire} dispose={null} />
            <mesh ref={(m) => void (cores.current[g] = m)} geometry={CORE} material={fire} dispose={null} />
            <sprite ref={(s) => void (glows.current[g] = s)} material={glow} />
          </group>
        </group>
      ))}
      {materials.map((material, i) => (
        <mesh key={i} geometry={PUFF_BALL} material={material} ref={(b) => void (balls.current[i] = b)} visible={false} dispose={null} />
      ))}
    </>
  );
}
