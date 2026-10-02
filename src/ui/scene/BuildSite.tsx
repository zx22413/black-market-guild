import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { SpriteMaterial, type Group, type Mesh, type MeshBasicMaterial, type Sprite } from 'three';
import type { AssetId } from '../../game';
import { Building } from './buildings/Building';
import { BUILD_SECONDS, buildSparks, completionFlash, groundRing, riseScale, sparkProgress } from './buildMath';
import type { Vec3 } from './layout';

/** Kenney Particle Pack sparkles (CC0; see public/art/SOURCES.md), the same ones as the black market rush. */
const SPARKLES = ['star_05', 'star_06', 'star_07'].map((name) => `${import.meta.env.BASE_URL}art/particles/${name}.png`);
// Load before the first building is bought: a texture that suspends mid-game would hide the whole table.
useTexture.preload(SPARKLES);
const GOLD = '#ffd25c';
const FLASH_HEIGHT = 2.2;
const FLASH_SIZE = 20;

interface BuildSiteProps {
  readonly asset: AssetId;
  readonly color: string;
  readonly position: Vec3;
  readonly scale: number;
  /** Play the construction effect: true for a building that appears while the table is on screen. */
  readonly animate: boolean;
  /** Dev preview only: hold the effect at this many seconds instead of playing it. */
  readonly freezeAt?: number;
}

/**
 * A guild's asset building. One that is bought during the game "loads" up out of the ground, then
 * finishes with a flash of gold light, a ring on the ground and a burst of rising sparkles.
 */
export function BuildSite({ asset, color, position, scale, animate, freezeAt }: BuildSiteProps) {
  if (!animate) return <Building asset={asset} color={color} position={position} scale={scale} />;
  // Its own boundary, so a late texture can only delay this building, never blank the table.
  return (
    <Suspense fallback={null}>
      <Constructing asset={asset} color={color} position={position} scale={scale} {...(freezeAt === undefined ? {} : { freezeAt })} />
    </Suspense>
  );
}

function Constructing({ asset, color, position, scale, freezeAt }: Omit<BuildSiteProps, 'animate'>) {
  const textures = useTexture(SPARKLES);
  const sparks = useMemo(() => buildSparks(Math.random), []);
  const materials = useMemo(
    () => sparks.map(() => new SpriteMaterial({ color: GOLD, alphaMap: textures[0] ?? null, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })),
    [sparks, textures],
  );
  const flashMaterial = useMemo(
    () => new SpriteMaterial({ color: '#fff1b8', alphaMap: textures[0] ?? null, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    [textures],
  );
  useEffect(
    () => () => {
      materials.forEach((m) => m.dispose());
      flashMaterial.dispose();
    },
    [materials, flashMaterial],
  );

  const body = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const ringMaterial = useRef<MeshBasicMaterial>(null);
  const flash = useRef<Sprite>(null);
  const sparkSprites = useRef<(Sprite | null)[]>([]);
  const elapsed = useRef(0);
  const [done, setDone] = useState(false);

  useFrame((_, rawDelta) => {
    elapsed.current = freezeAt ?? elapsed.current + Math.min(rawDelta, 0.1);
    const t = elapsed.current;
    const height = riseScale(t);
    // Slightly narrower while it is low, so it looks like it is growing rather than being stretched.
    const width = 0.9 + 0.1 * Math.min(1, height);
    body.current?.scale.set(scale * width, scale * height, scale * width);

    const { radius, opacity } = groundRing(t);
    ring.current?.scale.setScalar(radius);
    if (ringMaterial.current) ringMaterial.current.opacity = opacity;

    const glow = completionFlash(t);
    flashMaterial.opacity = glow;
    flash.current?.scale.setScalar(FLASH_SIZE * (0.6 + 0.6 * (1 - glow)));

    sparks.forEach((spark, i) => {
      const sprite = sparkSprites.current[i];
      const material = materials[i]!;
      const k = sparkProgress(spark, t);
      if (!sprite) return;
      if (k === null) {
        material.opacity = 0;
        return;
      }
      const age = k * spark.life;
      material.alphaMap = textures[spark.kind] ?? null;
      material.opacity = Math.min(1, k * 6, (1 - k) * 2.2);
      material.rotation = spark.angle + age * spark.spin;
      const out = spark.radius + spark.drift * age;
      sprite.position.set(Math.cos(spark.angle) * out, 0.4 + spark.rise * age, Math.sin(spark.angle) * out);
      sprite.scale.setScalar(spark.size * (1 - 0.4 * k));
    });

    if (t > BUILD_SECONDS) setDone(true);
  });

  return (
    <>
      <group ref={body} position={position} scale={[scale, scale * riseScale(0), scale]}>
        <Building asset={asset} color={color} />
      </group>
      {done ? null : (
        <group position={position}>
          <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.45, 0]} renderOrder={2}>
            <ringGeometry args={[0.8, 1, 64]} />
            <meshBasicMaterial ref={ringMaterial} color={GOLD} transparent opacity={0} depthWrite={false} toneMapped={false} />
          </mesh>
          <sprite ref={flash} material={flashMaterial} position={[0, FLASH_HEIGHT, 0]} />
          {materials.map((material, i) => (
            <sprite
              key={i}
              ref={(s) => {
                sparkSprites.current[i] = s;
              }}
              material={material}
            />
          ))}
        </group>
      )}
    </>
  );
}
