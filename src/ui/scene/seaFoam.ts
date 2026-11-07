import { Color, DataTexture, FloatType, MeshStandardMaterial, NearestFilter, RGBAFormat, Vector2, Vector4 } from 'three';
import { loopSegments, type FoamSegment, type SeaPoint } from './islandShape';

/** The target island, four guild islands and a headland (or annex) for each of them. */
const MAX_SHORES = 9;
/**
 * Most waterline segments one island can bring (the Blender bases are cut at sea level and simplified to fit,
 * scripts/blender/island_kit.py `foam_segments`), and all of them together, laid in a float texture so the count is
 * not bound by the GPU's uniform limit.
 */
const MAX_SEGMENTS = 240;
const SEGMENT_TEXELS = MAX_SHORES * MAX_SEGMENTS;
/** How far past an island's segments a pixel can still get foam: the widest band plus its flecks. */
const FOAM_REACH = 4.5;

/** Uniforms the sea updates every frame to drive the foam. */
export interface FoamUniforms {
  /** 0 = calm (a thin shore line only), 1 = wide churning shore foam and streaks on open water. */
  readonly uFoam: { value: number };
  /** Wave phase, so the foam breathes and drifts with the waves. */
  readonly uTime: { value: number };
  /** How much the sea darkens toward the corners, 0..1. */
  readonly uVignette: { value: number };
  /** White wave lines on open water whatever the weather, 0..1 (rough seas add their own). */
  readonly uLines: { value: number };
  /** How much the foam and wave lines glow faintly on their own (at night), 0..1. */
  readonly uGlow: { value: number };
  /** Every island's waterline segments (x0, z0, x1, z1), one texel each, island after island. */
  readonly uSegments: { value: DataTexture };
  /** Each island's bounds (centre x, z and reach) and its run of texels (start, count). */
  readonly uShoreBound: { value: Vector4[] };
  readonly uShoreRange: { value: Vector2[] };
  readonly uShoreCount: { value: number };
}

const FOAM_COLOR = '#f4fbfb';
/** Half-size of the island cluster the vignette leaves untouched (guild islands sit about 52 x 44 out). */
const VIGNETTE = { x: 68, z: 58 } as const;
/** How far the foam whitens the sea: kept low so the foam reads as a soft tint, not white paint. */
const FOAM_OPACITY = 0.5;

const VERTEX_HEAD = /* glsl */ `
varying vec2 vFoamXZ;
`;

const VERTEX_BODY = /* glsl */ `
vFoamXZ = (modelMatrix * vec4(position, 1.0)).xz;
`;

const FRAGMENT_HEAD = /* glsl */ `
#define MAX_SHORES ${MAX_SHORES}
#define MAX_SEGMENTS ${MAX_SEGMENTS}
uniform float uFoam;
uniform float uTime;
uniform sampler2D uSegments;
uniform vec4 uShoreBound[MAX_SHORES];
uniform vec2 uShoreRange[MAX_SHORES];
uniform int uShoreCount;
uniform vec3 uFoamColor;
uniform float uVignette;
uniform float uLines;
uniform float uGlow;
// How much foam covers this pixel, set in the colour pass and reused for the glow.
float foamAmount;
uniform float uFoamOpacity;
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

// Distance to the nearest island waterline (inside an island it does not matter: the island hides it). Islands
// whose bounds are out of the foam's reach are skipped, so a pixel only walks the segments of the island it is near.
float shoreDistance(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < MAX_SHORES; i++) {
    if (i >= uShoreCount) break;
    vec4 bound = uShoreBound[i];
    if (length(p - bound.xy) > bound.z + ${FOAM_REACH.toFixed(1)}) continue;
    int start = int(uShoreRange[i].x);
    int count = int(uShoreRange[i].y);
    for (int k = 0; k < MAX_SEGMENTS; k++) {
      if (k >= count) break;
      vec4 s = texelFetch(uSegments, ivec2(start + k, 0), 0);
      d = min(d, segmentDistance(p, s.xy, s.zw));
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
  float lines = max(rough, uLines);
  vec2 s = vFoamXZ * vec2(0.22, 1.4) + vec2(uTime * 0.3, 0.0);
  float sn = foamNoise(s) * 0.7 + foamNoise(s * 2.1 + 9.0) * 0.3;
  // Rough seas break into patches of streaks; steady wave lines (uLines) spread more evenly.
  float region = mix(smoothstep(0.55, 0.75, foamNoise(vFoamXZ * 0.04 + vec2(uTime * 0.02, 0.0))), 1.0, uLines * 0.7);
  float streaks = lines * region * smoothstep(0.0, 0.03, sn - 0.8) * mix(0.5, 0.85, uLines);

  foamAmount = max(max(shore, flecks), streaks);
  diffuseColor.rgb = mix(diffuseColor.rgb, uFoamColor, foamAmount * uFoamOpacity);

  // Vignette: an ellipse around the islands (wider than deep, like the table) stays as it is and the
  // sea darkens beyond it, deepest toward the corners of the screen.
  float reach = length(vFoamXZ / vec2(${VIGNETTE.x.toFixed(1)}, ${VIGNETTE.z.toFixed(1)}));
  diffuseColor.rgb *= 1.0 - uVignette * smoothstep(1.0, 2.2, reach);
}
`;

// Faint glow: the foam and wave lines light up a little on their own, so they still read on a dark sea.
const GLOW_BODY = /* glsl */ `
totalEmissiveRadiance += uFoamColor * foamAmount * uGlow;
`;

/** Standard sea material plus shore foam and rough-sea streaks; the sea's own colour is untouched. */
export function createSeaMaterial(): { readonly material: MeshStandardMaterial; readonly uniforms: FoamUniforms } {
  const uniforms: FoamUniforms = {
    uFoam: { value: 0 },
    uTime: { value: 0 },
    uVignette: { value: 0 },
    uLines: { value: 0 },
    uGlow: { value: 0 },
    uSegments: { value: segmentTexture() },
    uShoreBound: { value: Array.from({ length: MAX_SHORES }, () => new Vector4()) },
    uShoreRange: { value: Array.from({ length: MAX_SHORES }, () => new Vector2()) },
    uShoreCount: { value: 0 },
  };
  const material = new MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uFoamColor: { value: new Color(FOAM_COLOR) }, uFoamOpacity: { value: FOAM_OPACITY } });
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

function segmentTexture(): DataTexture {
  const texture = new DataTexture(new Float32Array(SEGMENT_TEXELS * 4), SEGMENT_TEXELS, 1, RGBAFormat, FloatType);
  texture.magFilter = texture.minFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Loads every island's waterline segments into the foam (an island's beyond `MAX_SEGMENTS` are dropped, islands beyond
 * `MAX_SHORES` get no foam), with each island's bounds so the shader skips the ones a pixel is far from.
 */
export function setFoam(uniforms: FoamUniforms, islands: readonly (readonly FoamSegment[])[]): void {
  const data = uniforms.uSegments.value.image.data as Float32Array;
  const used = islands.slice(0, MAX_SHORES);
  let at = 0;
  used.forEach((segs, i) => {
    const list = segs.slice(0, MAX_SEGMENTS);
    let [minX, minZ, maxX, maxZ] = [Infinity, Infinity, -Infinity, -Infinity];
    list.forEach(([ax, az, bx, bz], k) => {
      data.set([ax, az, bx, bz], (at + k) * 4);
      [minX, maxX] = [Math.min(minX, ax, bx), Math.max(maxX, ax, bx)];
      [minZ, maxZ] = [Math.min(minZ, az, bz), Math.max(maxZ, az, bz)];
    });
    const [cx, cz] = list.length ? [(minX + maxX) / 2, (minZ + maxZ) / 2] : [0, 0];
    uniforms.uShoreBound.value[i]!.set(cx, cz, list.length ? Math.hypot(maxX - minX, maxZ - minZ) / 2 : -1e5, 0);
    uniforms.uShoreRange.value[i]!.set(at, list.length);
    at += list.length;
  });
  uniforms.uSegments.value.needsUpdate = true;
  uniforms.uShoreCount.value = used.length;
}

/** Loads closed waterlines (the craggy cliffs' 11 points) into the foam. */
export function setShores(uniforms: FoamUniforms, shores: readonly (readonly SeaPoint[])[]): void {
  setFoam(uniforms, shores.map(loopSegments));
}
