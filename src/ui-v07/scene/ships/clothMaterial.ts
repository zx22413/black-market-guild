import { CanvasTexture, ClampToEdgeWrapping, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace, Vector3, Vector4, type Material, type Texture } from 'three';
import { SWATCHES } from '../../../ui/scene/buildings/materials';
import type { SailCloth, SailEmblem } from './cloth';

/** Seconds on the table clock, shared by every sail's shader (set once a frame by `ShipModel`). */
export const CLOTH_TIME = { value: 0 };

/**
 * How hard the wind fills a ship's sails: `value` 0 becalmed at the dock … 1 under way, and `gale` how rough the weather
 * is (0 a fair day, about 0.6 a tailwind, 1 a storm). One per ship, both eased by `ShipModel`.
 */
export interface Wind {
  value: number;
  gale: number;
}

/** What one sail needs from the shader: its extent in its own frame, how it bulges and flaps, and a phase so sails differ. */
export interface ClothBend {
  readonly span: SailCloth['span'];
  readonly belly: number;
  readonly flutter: number;
  readonly phase: number;
  /** A square sail's fuller cut (`SailSpec.square`). */
  readonly square: boolean;
}

/**
 * Bends a cloth's plates in the vertex shader: the middle bulges along the cloth's normal (y in its frame), fuller as the
 * wind rises and breathing a little, and the free end flaps in waves running away from the edge it hangs from. Each sail's
 * numbers are uniforms, so every sail of a kind shares one compiled shader.
 */
function bend<M extends Material>(material: M, cloth: ClothBend, wind: Wind, kind: string, emblem?: SailEmblem): M {
  const [u0, u1] = cloth.span.u;
  const uniforms = {
    uClothTime: CLOTH_TIME,
    uWind: { get value() { return wind.value; } },
    uGale: { get value() { return wind.gale; } },
    uClothSpan: { value: new Vector3(u0, Math.max(u1 - u0, 1e-3), Math.max(cloth.span.w, 1e-3)) },
    uClothShape: { value: new Vector3(cloth.belly, cloth.flutter, cloth.phase) },
    uClothSquare: { value: cloth.square ? 1 : 0 },
    // The emblem's square in the sail's frame: its centre (u, w) and size; and the art drawn on it.
    uEmblemRect: { value: emblem ? new Vector4(emblem.u, emblem.w, emblem.size, 0) : new Vector4(0, 0, 1, 0) },
    uEmblem: { value: emblem ? emblemTexture(emblem) : null },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uClothTime;\nuniform float uWind;\nuniform float uGale;\nuniform vec3 uClothSpan;\nuniform vec3 uClothShape;\nuniform float uClothSquare;\nvarying vec2 vClothUW;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vClothUW = vec2(transformed.x, transformed.z);
        float clothU = clamp((transformed.x - uClothSpan.x) / uClothSpan.y * 2.0 - 1.0, -1.0, 1.0);
        float clothV = clamp(transformed.z / uClothSpan.z, 0.0, 1.0);
        // Breathing: a slow swell of the belly on a fair day, joined by quicker, deeper gusts as the weather roughens (two
        // fixed frequencies blended by uGale, so easing the gale never jumps the phase).
        float clothSlow = sin(uClothTime * 1.3 + uClothShape.z);
        float clothFast = sin(uClothTime * 2.9 + uClothShape.z * 1.7) * 0.6 + sin(uClothTime * 4.7 + uClothShape.z) * 0.4;
        float clothGust = 1.0 + (0.26 + 0.14 * uGale) * clothSlow + 0.3 * uGale * clothFast;
        float clothFull = (0.35 + 0.65 * uWind) * (1.0 + 0.25 * uGale);
        // A loose-footed sail bulges only in its middle; a square sail fills down to its foot (deepest about two thirds
        // down) and out toward its leeches.
        float clothArch = mix((1.0 - clothU * clothU) * sin(3.14159 * clothV), (1.0 - 0.55 * clothU * clothU) * sin(3.14159 * 0.7 * clothV), uClothSquare);
        transformed.y += clothFull * uClothShape.x * clothArch * clothGust;
        // Ripples running down the cloth from the yard (pinned there), small on a fair day, rolling hard in a storm.
        float clothRipple = (0.08 + 0.32 * uGale) * (0.4 + 0.6 * uWind);
        float clothWave = mix(sin(clothV * 4.0 - uClothTime * 2.4 + clothU * 1.5 + uClothShape.z), sin(clothV * 6.0 - uClothTime * 5.2 + clothU * 2.5 + uClothShape.z), uGale);
        transformed.y += uClothShape.x * clothRipple * clothV * sqrt(1.0 - clothU * clothU) * clothWave;
        // Two fixed frequencies blended by uWind (never uClothTime * f(uWind)): the clock is large late in a match, so a
        // frequency that eases as the ship docks or sails would sweep the phase by hundreds of radians a second and the
        // rags would thrash for as long as the easing lasts.
        float clothFlap = mix(sin(clothV * 5.0 - uClothTime * 3.0 + uClothShape.z + clothU * 2.0), sin(clothV * 5.0 - uClothTime * 6.0 + uClothShape.z + clothU * 2.0), uWind);
        transformed.y += uClothShape.y * (1.0 + 0.6 * uGale) * clothV * clothFlap;`,
      );
    if (emblem) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec4 uEmblemRect;\nuniform sampler2D uEmblem;\nvarying vec2 vClothUW;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          // The texture clamps to its transparent margin, so outside the square nothing is painted (no hard cut, no seam).
          vec2 emblemUV = (vClothUW - uEmblemRect.xy) / uEmblemRect.z + 0.5;
          vec4 painted = texture2D(uEmblem, vec2(emblemUV.x, 1.0 - emblemUV.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, painted.rgb, painted.a);`,
        );
    }
  };
  material.customProgramCacheKey = () => `ship-cloth-${kind}${emblem ? '-emblem' : ''}`;
  return material;
}

/** A sail in its swatch colours (vertex colours), lit like the rest of the ship; flat shading follows the bent cloth, so its belly catches the light. */
export function sailMaterial(cloth: ClothBend, wind: Wind, emblem?: SailEmblem): MeshStandardMaterial {
  return bend(new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), cloth, wind, 'sail', emblem);
}

/** Outline colour of painted devices: the dark warm brown the design sheets ink with. */
const EMBLEM_INK = '#4a2f25';
const emblems = new Map<string, Texture>();

/**
 * A sail's painted device as a texture (drawn once per art and colour, shared): 巨鯨號's whale's flukes in cream on a
 * disc of its colour, inked round the edge. Square, transparent outside the disc.
 */
function emblemTexture(emblem: SailEmblem): Texture {
  const key = `${emblem.art}:${emblem.mat}`;
  const hit = emblems.get(key);
  if (hit) return hit;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no 2D canvas for the sail emblem');
  const swatch = SWATCHES[emblem.mat];
  const c = size / 2;
  g.beginPath();
  g.arc(c, c, c - 8, 0, Math.PI * 2);
  g.fillStyle = swatch.top;
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = EMBLEM_INK;
  g.stroke();
  g.beginPath();
  g.arc(c, c, c - 26, 0, Math.PI * 2);
  g.lineWidth = 5;
  g.strokeStyle = SWATCHES.canvas.top;
  g.stroke();
  ({ 'whale-tail': drawFlukes, albatross: drawAlbatross, wave: drawWave } as const)[emblem.art](g, c);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.anisotropy = 4;
  emblems.set(key, texture);
  return texture;
}

/** 巨鯨號's whale's flukes (the design sheet's emblem path, 5×), a little below the middle. */
function drawFlukes(g: CanvasRenderingContext2D, c: number): void {
  g.save();
  g.translate(c, c + 12);
  g.scale(5, 5);
  g.beginPath();
  g.moveTo(0, 13);
  g.bezierCurveTo(-1, 4, -4, -2, -10, -6);
  g.bezierCurveTo(-16, -9, -19, -14, -18, -18);
  g.bezierCurveTo(-12, -13, -6, -12, 0, -6);
  g.bezierCurveTo(6, -12, 12, -13, 18, -18);
  g.bezierCurveTo(19, -14, 16, -9, 10, -6);
  g.bezierCurveTo(4, -2, 1, 4, 0, 13);
  g.closePath();
  g.fillStyle = SWATCHES.canvas.top;
  g.fill();
  g.lineWidth = 1.1;
  g.strokeStyle = EMBLEM_INK;
  g.stroke();
  g.restore();
}

/**
 * 信天翁號's albatross (docs/art/standard-concept.svg): a seabird's "M", long wings bent at the wrist with dark tips,
 * dipping to a small body, in cream, inked. Points in sail units (y up) from the blockout, 149 px each (the disc spans `size`).
 */
function drawAlbatross(g: CanvasRenderingContext2D, c: number): void {
  const unit = 149;
  const path = (points: readonly (readonly [number, number])[], fill: string) => {
    g.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? g.moveTo(c + x * unit, c - y * unit * 2.2) : g.lineTo(c + x * unit, c - y * unit * 2.2)));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineJoin = 'round';
    g.lineWidth = 3.5;
    g.strokeStyle = EMBLEM_INK;
    g.stroke();
  };
  // A seabird's "M": two long wings bent at the wrist, dipping to a small body (drawn 2.2× taller than the outline, to read small).
  const bird = [
    [-0.74, -0.04], [-0.5, 0.17], [-0.24, 0.15], [-0.07, 0.04], [0, 0.11], [0.07, 0.04], [0.24, 0.15], [0.5, 0.17], [0.74, -0.04],
    [0.5, 0.06], [0.24, 0.03], [0.07, -0.1], [0, -0.16], [-0.07, -0.1], [-0.24, 0.03], [-0.5, 0.06],
  ] as const;
  path(bird, SWATCHES.canvas.top);
  for (const s of [1, -1]) path([[s * 0.74, -0.04], [s * 0.6, 0.08], [s * 0.6, 0.02]], SWATCHES.dark.top);
}

/**
 * 海嘯號's wave (docs/art/breaker-concept.svg): a crest rising from the left and curling over to the right above a flat
 * trough, in cream, inked. Points in sail units (y up) from the blockout; the disc spans the emblem's `size` (1.32).
 */
function drawWave(g: CanvasRenderingContext2D, c: number): void {
  const unit = 194;
  const wave = [
    [-0.42, -0.2], [-0.3, -0.05], [-0.12, 0.14], [0.06, 0.26], [0.24, 0.27], [0.36, 0.18], [0.38, 0.06], [0.28, 0], [0.2, 0.07],
    [0.22, 0.15], [0.12, 0.16], [0, 0.06], [-0.08, -0.12], [0, -0.22], [0.42, -0.22], [0.42, -0.32], [-0.42, -0.32],
  ] as const;
  g.beginPath();
  wave.forEach(([x, y], i) => (i === 0 ? g.moveTo(c + x * unit, c - y * unit) : g.lineTo(c + x * unit, c - y * unit)));
  g.closePath();
  g.fillStyle = SWATCHES.canvas.top;
  g.fill();
  g.lineJoin = 'round';
  g.lineWidth = 3.5;
  g.strokeStyle = EMBLEM_INK;
  g.stroke();
}

/** The owner's pennant, one flat colour. */
export function pennantMaterial(cloth: ClothBend, wind: Wind, color: string): MeshStandardMaterial {
  return bend(new MeshStandardMaterial({ color, roughness: 0.8, flatShading: true }), cloth, wind, 'pennant');
}

/** The ghost ship's rags at night: unlit, glowing (its colour pulses, set by `ShipModel`). */
export function glowMaterial(cloth: ClothBend, wind: Wind, color: string): MeshBasicMaterial {
  return bend(new MeshBasicMaterial({ color, toneMapped: false }), cloth, wind, 'glow');
}
