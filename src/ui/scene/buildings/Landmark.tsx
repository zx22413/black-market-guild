import { useTexture } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, Float32BufferAttribute, MeshBasicMaterial, MeshStandardMaterial, SpriteMaterial, type BufferGeometry, type Group, type Sprite } from 'three';
import { useLiveFrame } from '../liveFrame';
import { SPARKLES } from '../sparkles';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { geometryFromParts } from './Building';
import type { KitPart } from './kit';
import type { LandmarkDesign, LandmarkFlag, LandmarkRotor } from './islands/design';
import { LANDMARK_DESIGNS, type LandmarkId } from './landmarks';
import { tiltPoint, type Vec3 } from './polyhedra';
import { GLOWING_MATS } from './materials';

interface LandmarkGeometry {
  readonly lit: BufferGeometry;
  /** Treasure parts, drawn unlit and pulsing; null when the design has none. */
  readonly glowing: BufferGeometry | null;
  /** Tongues of flame, which sway and flicker; null when the design has none. */
  readonly flames: BufferGeometry | null;
  /** The rotor's parts, moved so its pivot is the origin; null when the design has none. */
  readonly rotor: BufferGeometry | null;
  /** Each flag's parts, moved so its hinge on the pole is the origin. */
  readonly flags: readonly BufferGeometry[];
}

/** Built once per design and shared by every island that shows it. */
const geometryCache = new Map<LandmarkId, LandmarkGeometry>();

function geometryOf(design: LandmarkId): LandmarkGeometry {
  const cached = geometryCache.get(design);
  if (cached) return cached;
  const { parts } = LANDMARK_DESIGNS[design];
  const glowing = parts.filter((part) => GLOWING_MATS.has(part.mat) && part.mat !== 'flame');
  const flames = parts.filter((part) => part.mat === 'flame');
  const { rotor, flags = [] }: LandmarkDesign = LANDMARK_DESIGNS[design];
  const geometry = {
    lit: geometryFromParts(parts.filter((part) => !GLOWING_MATS.has(part.mat))),
    glowing: glowing.length > 0 ? geometryFromParts(glowing) : null,
    flames: flames.length > 0 ? flameGeometry(flames) : null,
    rotor: rotor ? geometryFromParts(rotor.parts).translate(-rotor.pivot[0], -rotor.pivot[1], -rotor.pivot[2]) : null,
    flags: flags.map(({ parts: cloth, hinge }) => geometryFromParts(cloth).translate(-hinge[0], -hinge[1], -hinge[2])),
  };
  geometryCache.set(design, geometry);
  return geometry;
}

const GLINT_COLOR = '#fff1b8';
/** A glint's size in the design's units, before the piece's scale. */
const GLINT_SIZE = 0.8;

/**
 * The flame parts as one geometry, each vertex tagged with how far up its own tongue it sits (0 at the
 * foot, 1 at the tip) and which tongue it belongs to, so the shader sways tips and keeps feet still.
 */
function flameGeometry(parts: readonly KitPart[]): BufferGeometry {
  const geometries = parts.map((part) => geometryFromParts([part]));
  const merged = mergeGeometries(geometries)!;
  const lift: number[] = [];
  const tongue: number[] = [];
  geometries.forEach((g, i) => {
    g.computeBoundingBox();
    const { min, max } = g.boundingBox!;
    const position = g.attributes.position!;
    for (let v = 0; v < position.count; v++) {
      lift.push((position.getY(v) - min.y) / Math.max(1e-6, max.y - min.y));
      tongue.push(i * 1.618);
    }
    g.dispose();
  });
  merged.setAttribute('flameLift', new Float32BufferAttribute(lift, 1));
  merged.setAttribute('flameSeed', new Float32BufferAttribute(tongue, 1));
  return merged;
}

/** Seconds on the table clock for the flames' shader. */
const flameTime = { value: 0 };

/** Fire: unlit and bright, each tongue swaying, stretching and shrinking out of step with the others. */
function Flames({ geometry }: { readonly geometry: BufferGeometry }) {
  const material = useMemo(() => {
    const m = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uFlameTime = flameTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
        uniform float uFlameTime;
        attribute float flameLift;
        attribute float flameSeed;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float flameT = uFlameTime * 9.0 + flameSeed;
          float flameSway = flameLift * flameLift;
          transformed.x += flameSway * 0.05 * (sin(flameT) + 0.5 * sin(flameT * 2.3 + 1.0));
          transformed.z += flameSway * 0.05 * (cos(flameT * 1.3) + 0.5 * sin(flameT * 3.1));
          transformed.y += flameLift * 0.06 * sin(flameT * 1.7 + 2.0);`,
        );
    };
    m.customProgramCacheKey = () => 'landmark-flame';
    return m;
  }, []);
  useEffect(() => () => material.dispose(), [material]);
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime;
    flameTime.value = t;
    // A quick, uneven flicker on top of the colors.
    material.color.setScalar(1.25 + 0.2 * Math.sin(t * 17) + 0.12 * Math.sin(t * 29 + 1.3));
  });
  return <mesh geometry={geometry} material={material} dispose={null} />;
}

/** Gold breathing on the treasure: its colors brighten and dim a little, never below their own. */
function TreasurePulse({ geometry }: { readonly geometry: BufferGeometry }) {
  const material = useRef<MeshBasicMaterial>(null);
  useLiveFrame(({ clock }) => {
    material.current?.color.setScalar(1.2 + 0.35 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4)));
  });
  return (
    <mesh geometry={geometry} castShadow dispose={null}>
      <meshBasicMaterial ref={material} vertexColors toneMapped={false} />
    </mesh>
  );
}

/** Four-point star glints twinkling one after another over the treasure. */
function Glints({ at }: { readonly at: readonly (readonly [number, number, number])[] }) {
  const textures = useTexture(SPARKLES);
  const materials = useMemo(
    () => at.map((_, i) => new SpriteMaterial({ color: GLINT_COLOR, alphaMap: textures[2 - (i % 2)] ?? null, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })),
    [at, textures],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const sprites = useRef<(Sprite | null)[]>([]);
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime;
    materials.forEach((material, i) => {
      // Each glint flashes briefly once every couple of seconds, out of step with the others.
      const phase = (t * 0.55 + i * 0.37) % 1;
      const flash = Math.max(0, 1 - Math.abs(phase - 0.5) * 6);
      material.opacity = flash;
      material.rotation = t * 0.8 + i;
      sprites.current[i]?.scale.setScalar(GLINT_SIZE * (0.4 + 0.6 * flash));
    });
  });
  return (
    <>
      {at.map(([x, y, z], i) => (
        <sprite
          key={i}
          ref={(s) => {
            sprites.current[i] = s;
          }}
          position={[x, y, z]}
          material={materials[i]!}
        />
      ))}
    </>
  );
}

/** The design's rotor (windmill sails) turning steadily about its pivot. */
function Rotor({ rotor, geometry }: { readonly rotor: LandmarkRotor; readonly geometry: BufferGeometry }) {
  const hub = useRef<Group>(null);
  useLiveFrame(({ clock }) => {
    if (hub.current) hub.current.rotation[rotor.axis] = clock.elapsedTime * rotor.speed;
  });
  return (
    <group position={[...rotor.pivot]} ref={hub}>
      <mesh geometry={geometry} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Seconds on the table clock, shared by every waving flag's shader. */
const flagTime = { value: 0 };
/** How the cloth waves: sideways sway at the fly end, the waves along it, and how fast they run. */
const FLAG_WAVE = { amplitude: 0.22, wavenumber: 18, speed: 5 } as const;

/**
 * A flag's material: vertex colors like the rest of the model, with the cloth pushed sideways in waves
 * that grow from nothing at the pole (x = 0) to the fly end and run outward over time.
 */
function flagMaterial(phase: number): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFlagTime = flagTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uFlagTime;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float flagFly = max(transformed.x, 0.0);
        transformed.z += ${FLAG_WAVE.amplitude.toFixed(3)} * flagFly * sin(flagFly * ${FLAG_WAVE.wavenumber.toFixed(1)} - uFlagTime * ${FLAG_WAVE.speed.toFixed(1)} + ${phase.toFixed(3)});`,
      );
  };
  material.customProgramCacheKey = () => `landmark-flag-${phase.toFixed(3)}`;
  return material;
}

/** The design's flags, waving from their poles. */
function WavingFlags({ flags, geometries }: { readonly flags: readonly LandmarkFlag[]; readonly geometries: readonly BufferGeometry[] }) {
  const materials = useMemo(() => flags.map((_, i) => flagMaterial(i * 1.7)), [flags]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  useLiveFrame(({ clock }) => {
    flagTime.value = clock.elapsedTime;
  });
  return (
    <>
      {flags.map(({ hinge, tilt }, i) => (
        <mesh
          key={i}
          // A tilted flag leans with its pole: its hinge moves with the tilt and the cloth turns by it.
          position={[...(tilt ? tiltPoint(hinge, tilt) : hinge)]}
          rotation={tilt ? (tilt.axis === 'x' ? [tilt.angle, 0, 0] : [0, 0, tilt.angle]) : [0, 0, 0]}
          geometry={geometries[i]!}
          material={materials[i]!}
          castShadow
          dispose={null}
        />
      ))}
    </>
  );
}

const SMOKE_COLOR = '#f2efea';
/** Puffs in flight above each fire, how long each takes to rise and fade, and how high it climbs (design units). */
const SMOKE = { puffs: 13, life: 5, rise: 2.2, drift: 2.6 } as const;

let puff: CanvasTexture | null = null;

/** A round puff, dense in the middle and soft at the edge, drawn once on a canvas. */
function puffTexture(): CanvasTexture {
  if (puff) return puff;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  puff = new CanvasTexture(canvas);
  return puff;
}

/** Soft grey puffs rising from each fire, swelling, drifting downwind and fading. */
function Smoke({ at }: { readonly at: readonly { readonly at: Vec3; readonly size: number }[] }) {
  const count = at.length * SMOKE.puffs;
  const materials = useMemo(
    () => Array.from({ length: count }, () => new SpriteMaterial({ color: SMOKE_COLOR, map: puffTexture(), transparent: true, opacity: 0, depthWrite: false })),
    [count],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const sprites = useRef<(Sprite | null)[]>([]);
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime;
    materials.forEach((material, i) => {
      const { at: [x, y, z], size } = at[Math.floor(i / SMOKE.puffs)]!;
      const k = ((t / SMOKE.life + (i % SMOKE.puffs) / SMOKE.puffs) % 1 + 1) % 1;
      // Fades in as it leaves the fire, so the flames underneath stay clear.
      material.opacity = 0.9 * Math.min(1, k / 0.3) * (1 - k);
      material.rotation = i + k * 1.5;
      const sprite = sprites.current[i];
      sprite?.position.set(x + k * k * SMOKE.drift * size + Math.sin(k * 6 + i) * 0.04 * size, y + k * SMOKE.rise * size, z + Math.cos(k * 5 + i) * 0.04 * size);
      sprite?.scale.setScalar((0.8 + k * 2.8) * size);
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
        />
      ))}
    </>
  );
}

type LandmarkProps = ThreeElements['group'] & { readonly design: LandmarkId };

/** A piece of island scenery, drawn from the same part list as `docs/art/islands-blueprint.svg`. */
export function Landmark({ design, ...props }: LandmarkProps) {
  const { lit, glowing, flames: flameGeometries, rotor: rotorGeometry, flags: flagGeometries } = geometryOf(design);
  const { glints, rotor, flags, smoke }: LandmarkDesign = LANDMARK_DESIGNS[design];
  return (
    <group {...props}>
      <mesh geometry={lit} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      {glowing && <TreasurePulse geometry={glowing} />}
      {flameGeometries && <Flames geometry={flameGeometries} />}
      {glints && <Glints at={glints} />}
      {rotor && rotorGeometry && <Rotor rotor={rotor} geometry={rotorGeometry} />}
      {flags && <WavingFlags flags={flags} geometries={flagGeometries} />}
      {smoke && <Smoke at={smoke} />}
    </group>
  );
}
