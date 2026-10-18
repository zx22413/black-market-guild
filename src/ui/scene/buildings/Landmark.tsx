import { useTexture } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, CylinderGeometry, ShaderMaterial, DoubleSide, Float32BufferAttribute, MeshBasicMaterial, MeshStandardMaterial, SpriteMaterial, type PointLight, type BufferGeometry, type Group, type Mesh, type Sprite } from 'three';
import { useLiveFrame } from '../liveFrame';
import { glowTexture } from '../Night';
import { SPARKLES } from '../sparkles';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { geometryFromParts } from './Building';
import type { KitPart } from './kit';
import type { LandmarkBeacon, LandmarkDesign, LandmarkFlag, LandmarkRotor } from './islands/design';
import { LANDMARK_DESIGNS, type LandmarkId } from './landmarks';
import { Birds } from './LandmarkBirds';
import { Boat } from './LandmarkBoat';
import { Salute } from './LandmarkSalute';
import { ropeLength } from './islands/birdFlight';
import { Train } from './LandmarkTrain';
import { PUFF_BALL, WOOD_SMOKE, puffOpacity, puffSwell, smokeBallMaterials } from './smokeBall';
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

/**
 * The design's rotor turning steadily about its pivot (windmill sails), or swinging to and fro on it
 * (a hanging lantern, a derrick's boom), its load let down at either end of the swing and hoisted between.
 */
function Rotor({ rotor, geometry }: { readonly rotor: LandmarkRotor; readonly geometry: BufferGeometry }) {
  const hub = useRef<Group>(null);
  const rope = useRef<Mesh>(null);
  const load = useRef<Group>(null);
  const { load: sling } = rotor;
  const [ropeGeometry, loadGeometry] = useMemo(
    () =>
      sling
        ? [geometryFromParts([{ kind: 'box', center: [0, -0.5, 0], size: [ROPE_WIDTH, 1, ROPE_WIDTH], mat: 'rope' }]), geometryFromParts(sling.parts)]
        : [null, null],
    [sling],
  );
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime * rotor.speed;
    const angle = rotor.swing === undefined ? t : rotor.swing * Math.sin(t);
    if (hub.current) hub.current.rotation[rotor.axis] = angle;
    if (sling && rotor.swing !== undefined) {
      const length = ropeLength(sling, angle, rotor.swing);
      rope.current?.scale.set(1, length, 1);
      load.current?.position.set(sling.from[0] - rotor.pivot[0], sling.from[1] - rotor.pivot[1] - length, sling.from[2] - rotor.pivot[2]);
    }
  });
  return (
    <group position={[...rotor.pivot]} ref={hub}>
      <mesh geometry={geometry} castShadow receiveShadow dispose={null}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </mesh>
      {sling && ropeGeometry && loadGeometry && (
        <>
          <mesh ref={rope} geometry={ropeGeometry} position={[sling.from[0] - rotor.pivot[0], sling.from[1] - rotor.pivot[1], sling.from[2] - rotor.pivot[2]]} dispose={null}>
            <meshStandardMaterial vertexColors roughness={0.9} />
          </mesh>
          <group ref={load}>
            <mesh geometry={loadGeometry} castShadow dispose={null}>
              <meshStandardMaterial vertexColors roughness={0.8} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
}

/** A rotor load's rope, in the design's units. */
const ROPE_WIDTH = 0.018;

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

/**
 * Balls of smoke above each fire, how long each lasts, how high it climbs and how far it drifts downwind,
 * its radius as it leaves the fire and how many times bigger it grows before it is gone (design units, for
 * a fire of size 1). A puff every 0.7 s: a third as often as the mine engine puffs.
 */
const SMOKE = { puffs: 7, life: 4.9, rise: 2.2, drift: 2.6, radius: 0.22, grow: 3.2 } as const;

/** Round puffs of smoke rising from each fire one after another, drifting downwind, swelling and thinning away. */
function Smoke({ at }: { readonly at: readonly { readonly at: Vec3; readonly size: number }[] }) {
  const count = at.length * SMOKE.puffs;
  const materials = useMemo(() => smokeBallMaterials(count, WOOD_SMOKE), [count]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const balls = useRef<(Mesh | null)[]>([]);
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime;
    materials.forEach((material, i) => {
      const { at: [x, y, z], size } = at[Math.floor(i / SMOKE.puffs)]!;
      const k = ((t / SMOKE.life + (i % SMOKE.puffs) / SMOKE.puffs) % 1 + 1) % 1;
      material.opacity = puffOpacity(k, 0.7);
      const ball = balls.current[i];
      ball?.position.set(x + k * k * SMOKE.drift * size + Math.sin(k * 6 + i) * 0.04 * size, y + SMOKE.radius * size + k * SMOKE.rise * size, z + Math.cos(k * 5 + i) * 0.04 * size);
      ball?.scale.setScalar(SMOKE.radius * size * puffSwell(k, SMOKE.grow));
      ball?.rotation.set(i, i * 2, 0);
    });
  });
  return (
    <>
      {materials.map((material, i) => (
        <mesh key={i} geometry={PUFF_BALL} material={material} ref={(b) => void (balls.current[i] = b)} dispose={null} />
      ))}
    </>
  );
}

const FIRE_LIGHT = '#ff9a45';
/** A fire's light strength per table unit of reach, like the island lanterns' (`Night`). */
const FIRE_INTENSITY_PER_REACH = 2.6;

/** A signal lamp's flashes over one cycle (seconds from its start, on until, off until): long, short, short, then dark. */
const SIGNAL_FLASHES = [
  [0.9, 1.3],
  [1.6, 1.9],
  [2.2, 3.4],
] as const;
const SIGNAL_CYCLE = 3.4;
/** How much of its light a signal lamp shows between flashes, shuttered but not quite dark. */
const SIGNAL_SHUTTERED = 0.08;

/** A signal lamp's brightness `seconds` in: full while it flashes, shuttered between. */
function signalLevel(seconds: number): number {
  const t = seconds % SIGNAL_CYCLE;
  let from = 0;
  for (const [on, off] of SIGNAL_FLASHES) {
    if (t >= from && t < on) return 1;
    if (t < off) return SIGNAL_SHUTTERED;
    from = off;
  }
  return SIGNAL_SHUTTERED;
}

/** Warm, flickering light from the design's fires and lamps, shown at night; signal lamps flash. */
function FireLights({ at }: { readonly at: readonly { readonly at: Vec3; readonly reach: number; readonly signal?: boolean }[] }) {
  const lights = useRef<(PointLight | null)[]>([]);
  useLiveFrame(({ clock }) => {
    const t = clock.elapsedTime;
    at.forEach(({ reach, signal }, i) => {
      const flicker = (1 - 0.18 * (0.5 + 0.5 * Math.sin(t * 9 + i * 2) * Math.sin(t * 14.3 + i))) * (signal ? signalLevel(t) : 1);
      const light = lights.current[i];
      if (light) light.intensity = reach * FIRE_INTENSITY_PER_REACH * flicker;
    });
  });
  return (
    <>
      {at.map(({ at: [x, y, z], reach }, i) => (
        <pointLight
          key={i}
          ref={(l) => {
            lights.current[i] = l;
          }}
          position={[x, y, z]}
          color={FIRE_LIGHT}
          distance={reach}
          decay={2}
          intensity={reach * FIRE_INTENSITY_PER_REACH}
        />
      ))}
    </>
  );
}

const BEAM_COLOR = '#ffb52e';
/** How fast the beam sweeps round (radians per second), how wide it opens at the sea, and how strong it is. */
const BEAM = { speed: 0.55, spread: 0.16, opacity: 0.2, pool: 0.6 } as const;

/**
 * The beam's light: strongest where the cone faces the camera and fading to nothing at its grazing
 * edges and toward the far end, so it reads as a soft, blurred shaft rather than a solid cone.
 */
function beamMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(BEAM_COLOR) }, uOpacity: { value: BEAM.opacity } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vAlong;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        vNormal = normalize(normalMatrix * normal);
        vAlong = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vAlong;
      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(vView)));
        float edge = smoothstep(0.0, 0.85, facing);
        float along = mix(1.0, 0.5, vAlong);
        gl_FragColor = vec4(uColor, uOpacity * edge * edge * along);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
}

/**
 * A lighthouse's beam sweeping round at night: a warm yellow cone of light from the lamp down to the
 * sea, ending in a bright pool on the water.
 */
function Beacon({ beacon }: { readonly beacon: LandmarkBeacon }) {
  const { at, reach, drop } = beacon;
  const turn = useRef<Group>(null);
  const length = Math.hypot(reach, drop);
  const dip = Math.atan2(drop, reach);
  const cone = useMemo(() => {
    // Narrow at the lamp, open toward the sea, lying along +x from the origin.
    const g = new CylinderGeometry(length * BEAM.spread, 0.04, length, 16, 1, true);
    g.translate(0, length / 2, 0);
    g.rotateZ(-Math.PI / 2);
    return g;
  }, [length]);
  useEffect(() => () => cone.dispose(), [cone]);
  const pool = useMemo(() => glowTexture(), []);
  const light = useMemo(beamMaterial, []);
  useEffect(() => () => light.dispose(), [light]);
  useLiveFrame(({ clock }) => {
    if (turn.current) turn.current.rotation.y = clock.elapsedTime * BEAM.speed;
  });
  return (
    <group position={[...at]}>
      <group ref={turn}>
        <mesh geometry={cone} material={light} rotation={[0, 0, -dip]} />
        <mesh position={[reach, -drop + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[length * BEAM.spread * 1.4, 24]} />
          <meshBasicMaterial map={pool} color={BEAM_COLOR} transparent opacity={BEAM.pool} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

type LandmarkProps = ThreeElements['group'] & {
  readonly design: LandmarkId;
  /** A moonless night: fires light their surroundings and lighthouse beams sweep the sea. */
  readonly night?: boolean;
};

/** A piece of island scenery, drawn from the same part list as `docs/art/islands-blueprint.svg`. */
export function Landmark({ design, night = false, ...props }: LandmarkProps) {
  const { lit, glowing, flames: flameGeometries, rotor: rotorGeometry, flags: flagGeometries } = geometryOf(design);
  const { glints, rotor, flags, smoke, lights, beacon, train, boat, birds, salute }: LandmarkDesign = LANDMARK_DESIGNS[design];
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
      {night && lights && <FireLights at={lights} />}
      {night && beacon && <Beacon beacon={beacon} />}
      {train && <Train train={train} />}
      {boat && <Boat boat={boat} />}
      {birds && <Birds birds={birds} />}
      {salute && <Salute salute={salute} />}
    </group>
  );
}
