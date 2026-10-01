import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide, ShaderMaterial, UniformsLib, UniformsUtils } from 'three';
import type { ScenePoint } from './stormMath';
import { WIND_DIRECTION, strokeWindow, windPath } from './windMath';

/** Wind lines on screen at once, each living a couple of seconds and then starting elsewhere. */
const LINES = 7;
const LIFE_SECONDS = 2.6;
/** Half-width of a wind line at its fullest. */
const HALF_WIDTH = 0.6;
const OPACITY = 0.8;
/** Where wind lines may start: over the table, shifted upwind so they blow across it. */
const AREA = { x: 75, z: 55 } as const;
const UPWIND = 18;

const VERTEX = /* glsl */ `
attribute float aAlong;
attribute float aSide;
attribute vec3 aOffset;
uniform float uTail;
uniform float uHead;
varying float vAlpha;
#include <common>
#include <fog_pars_vertex>
void main() {
  float span = max(uHead - uTail, 0.0001);
  float local = (aAlong - uTail) / span;
  float inside = step(0.0, local) * step(local, 1.0);
  // Thick in the middle of the visible stretch, tapering to a point at both ends.
  float taper = inside * sqrt(max(0.0, sin(clamp(local, 0.0, 1.0) * PI)));
  vec3 transformed = position + aOffset * aSide * taper;
  vAlpha = inside;
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform float uOpacity;
varying float vAlpha;
#include <common>
#include <fog_pars_fragment>
void main() {
  if (vAlpha < 0.5) discard;
  gl_FragColor = vec4(vec3(0.97, 0.99, 1.0), uOpacity);
  #include <fog_fragment>
}
`;

/**
 * A flat ribbon along the path, as wide as `HALF_WIDTH` sideways across the wind (always level, so
 * it reads from above even where the line loops over itself).
 */
function ribbon(path: readonly ScenePoint[]): BufferGeometry {
  const [dx, dz] = WIND_DIRECTION;
  const side: ScenePoint = [-dz * HALF_WIDTH, 0, dx * HALF_WIDTH];
  const n = path.length;
  const position = new Float32Array(n * 2 * 3);
  const offset = new Float32Array(n * 2 * 3);
  const along = new Float32Array(n * 2);
  const sides = new Float32Array(n * 2);
  path.forEach((p, i) => {
    for (let j = 0; j < 2; j++) {
      const v = i * 2 + j;
      position.set(p, v * 3);
      offset.set(side, v * 3);
      along[v] = i / (n - 1);
      sides[v] = j === 0 ? -1 : 1;
    }
  });
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(position, 3));
  g.setAttribute('aOffset', new BufferAttribute(offset, 3));
  g.setAttribute('aAlong', new BufferAttribute(along, 1));
  g.setAttribute('aSide', new BufferAttribute(sides, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

function randomStart(): [number, number] {
  const [dx, dz] = WIND_DIRECTION;
  return [(Math.random() - 0.5) * 2 * AREA.x - dx * UPWIND, (Math.random() - 0.5) * 2 * AREA.z - dz * UPWIND];
}

/** One wind line that draws itself on, slides downwind, wipes off and starts again elsewhere. */
function WindLine({ delay }: { readonly delay: number }) {
  const [path, setPath] = useState(() => windPath(randomStart(), Math.random));
  const geometry = useMemo(() => ribbon(path), [path]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: UniformsUtils.merge([UniformsLib.fog, { uTail: { value: 0 }, uHead: { value: 0 }, uOpacity: { value: OPACITY } }]),
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        fog: true,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  const age = useRef(-delay);

  useFrame((_, delta) => {
    age.current += Math.min(delta, 0.1);
    if (age.current >= LIFE_SECONDS) {
      age.current -= LIFE_SECONDS;
      setPath(windPath(randomStart(), Math.random));
    }
    const [tail, head] = strokeWindow(Math.max(0, age.current) / LIFE_SECONDS);
    material.uniforms.uTail!.value = tail;
    material.uniforms.uHead!.value = head;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

/** Tailwind weather: Wind Waker-style wind lines sweeping across the table toward the lower left. */
export function Wind() {
  return (
    <>
      {Array.from({ length: LINES }, (_, i) => (
        <WindLine key={i} delay={(i / LINES) * LIFE_SECONDS} />
      ))}
    </>
  );
}
