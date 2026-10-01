import { Color, MeshStandardMaterial, Vector2 } from 'three';
import { SHORE_POINTS, type SeaPoint } from './islandShape';

/** Most islands the foam can hug: the target island plus up to five guild islands. */
const MAX_SHORES = 6;

/** Uniforms the sea updates every frame to drive the foam. */
export interface FoamUniforms {
  /** 0 = calm (a thin shore line only), 1 = wide churning shore foam and streaks on open water. */
  readonly uFoam: { value: number };
  /** Wave phase, so the foam breathes and drifts with the waves. */
  readonly uTime: { value: number };
  /** How brightly the foam glows with plankton at night, 0..1. */
  readonly uGlow: { value: number };
  /** Every island's waterline, `SHORE_POINTS` per island. */
  readonly uShore: { value: Vector2[] };
  readonly uShoreCount: { value: number };
}

const FOAM_COLOR = '#f4fbfb';
/** Bioluminescent teal the foam glows on a moonless night. */
const GLOW_COLOR = '#3fe0c8';
/** How far the foam whitens the sea: kept low so the foam reads as a soft tint, not white paint. */
const FOAM_OPACITY = 0.5;

const VERTEX_HEAD = /* glsl */ `
varying vec2 vFoamXZ;
`;

const VERTEX_BODY = /* glsl */ `
vFoamXZ = (modelMatrix * vec4(position, 1.0)).xz;
`;

const FRAGMENT_HEAD = /* glsl */ `
#define SHORE_POINTS ${SHORE_POINTS}
#define MAX_SHORES ${MAX_SHORES}
uniform float uFoam;
uniform float uTime;
uniform vec2 uShore[MAX_SHORES * SHORE_POINTS];
uniform int uShoreCount;
uniform vec3 uFoamColor;
uniform float uFoamOpacity;
uniform float uGlow;
uniform vec3 uGlowColor;
// How much foam covers this pixel, set in the colour pass and reused for the night glow.
float foamAmount;
varying vec2 vFoamXZ;

float foamHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float foamNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(foamHash(i), foamHash(i + vec2(1.0, 0.0)), u.x),
    mix(foamHash(i + vec2(0.0, 1.0)), foamHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// Distance to the nearest island waterline (inside an island it does not matter: the cliff hides it).
float shoreDistance(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < MAX_SHORES; i++) {
    if (i >= uShoreCount) break;
    for (int j = 0; j < SHORE_POINTS; j++) {
      int next = j == SHORE_POINTS - 1 ? 0 : j + 1;
      d = min(d, segmentDistance(p, uShore[i * SHORE_POINTS + j], uShore[i * SHORE_POINTS + next]));
    }
  }
  return d;
}
`;

// Shore foam: a band hugging every island whose ragged outer edge breathes in and out, with a few
// loose flecks just beyond it; rougher seas widen and churn it. Open water stays clean except in
// rough seas, which get faint, long streaks. Every edge is cut per pixel, so it stays crisp.
const FRAGMENT_BODY = /* glsl */ `
{
  float d = shoreDistance(vFoamXZ);
  vec2 p = vFoamXZ * 0.35 + vec2(uTime * 0.1, -uTime * 0.07);
  float n = foamNoise(p) * 0.6 + foamNoise(p * 2.7 + 3.0) * 0.4;
  float width = 0.6 + uFoam * 1.5;
  float surge = 0.5 + 0.5 * sin(uTime * 1.3 + n * 5.0);
  float edge = width * (0.75 + 0.25 * surge) + (n - 0.5) * width * 0.8;
  float shore = 1.0 - smoothstep(edge - 0.06, edge, d);
  float near = 1.0 - smoothstep(edge, edge + width * 0.9, d);
  float flecks = near * smoothstep(0.0, 0.03, foamNoise(vFoamXZ * 0.9 + vec2(uTime * 0.15, 0.0)) - 0.7);

  float rough = smoothstep(0.5, 0.9, uFoam);
  vec2 s = vFoamXZ * vec2(0.22, 1.4) + vec2(uTime * 0.3, 0.0);
  float sn = foamNoise(s) * 0.7 + foamNoise(s * 2.1 + 9.0) * 0.3;
  float region = smoothstep(0.55, 0.75, foamNoise(vFoamXZ * 0.04 + vec2(uTime * 0.02, 0.0)));
  float streaks = rough * region * smoothstep(0.0, 0.03, sn - 0.8) * 0.5;

  foamAmount = max(max(shore, flecks), streaks);
  diffuseColor.rgb = mix(diffuseColor.rgb, uFoamColor, foamAmount * uFoamOpacity);
}
`;

// Night glow: the foam lights up teal on its own, so it shows even when the scene is dark.
const GLOW_BODY = /* glsl */ `
totalEmissiveRadiance += uGlowColor * foamAmount * uGlow * 0.8;
`;

/** Standard sea material plus shore foam and rough-sea streaks; the sea's own colour is untouched. */
export function createSeaMaterial(): { readonly material: MeshStandardMaterial; readonly uniforms: FoamUniforms } {
  const uniforms: FoamUniforms = {
    uFoam: { value: 0 },
    uTime: { value: 0 },
    uGlow: { value: 0 },
    uShore: { value: Array.from({ length: MAX_SHORES * SHORE_POINTS }, () => new Vector2()) },
    uShoreCount: { value: 0 },
  };
  const material = new MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uFoamColor: { value: new Color(FOAM_COLOR) }, uFoamOpacity: { value: FOAM_OPACITY }, uGlowColor: { value: new Color(GLOW_COLOR) } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_BODY}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${GLOW_BODY}`);
  };
  return { material, uniforms };
}

/** Loads the islands' waterlines into the foam uniforms; islands beyond `MAX_SHORES` get no foam. */
export function setShores(uniforms: FoamUniforms, shores: readonly (readonly SeaPoint[])[]): void {
  const used = shores.slice(0, MAX_SHORES);
  used.forEach((line, i) =>
    line.forEach(([x, z], j) => {
      uniforms.uShore.value[i * SHORE_POINTS + j]!.set(x, z);
    }),
  );
  uniforms.uShoreCount.value = used.length;
}
