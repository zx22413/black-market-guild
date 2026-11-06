import { CanvasTexture, ClampToEdgeWrapping, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace, Vector3, Vector4, type Material, type Texture } from 'three';
import { SWATCHES } from '../../../ui/scene/buildings/materials';
import type { SailCloth, SailEmblem } from './cloth';

/** Seconds on the table clock, shared by every sail's shader (set once a frame by `ShipModel`). */
export const CLOTH_TIME = { value: 0 };

/** How hard the wind fills a ship's sails: 0 becalmed at the dock … 1 under way. One per ship, eased by `ShipModel`. */
export interface Wind {
  value: number;
}

/** What one sail needs from the shader: its extent in its own frame, how it bulges and flaps, and a phase so sails differ. */
export interface ClothBend {
  readonly span: SailCloth['span'];
  readonly belly: number;
  readonly flutter: number;
  readonly phase: number;
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
    uWind: wind,
    uClothSpan: { value: new Vector3(u0, Math.max(u1 - u0, 1e-3), Math.max(cloth.span.w, 1e-3)) },
    uClothShape: { value: new Vector3(cloth.belly, cloth.flutter, cloth.phase) },
    // The emblem's square in the sail's frame: its centre (u, w) and size; and the art drawn on it.
    uEmblemRect: { value: emblem ? new Vector4(emblem.u, emblem.w, emblem.size, 0) : new Vector4(0, 0, 1, 0) },
    uEmblem: { value: emblem ? emblemTexture(emblem) : null },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uClothTime;\nuniform float uWind;\nuniform vec3 uClothSpan;\nuniform vec3 uClothShape;\nvarying vec2 vClothUW;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vClothUW = vec2(transformed.x, transformed.z);
        float clothU = clamp((transformed.x - uClothSpan.x) / uClothSpan.y * 2.0 - 1.0, -1.0, 1.0);
        float clothV = clamp(transformed.z / uClothSpan.z, 0.0, 1.0);
        float clothGust = 0.82 + 0.18 * sin(uClothTime * 1.3 + uClothShape.z);
        transformed.y += (0.35 + 0.65 * uWind) * uClothShape.x * (1.0 - clothU * clothU) * sin(3.14159 * clothV) * clothGust;
        transformed.y += uClothShape.y * clothV * sin(clothV * 5.0 - uClothTime * (3.0 + 3.0 * uWind) + uClothShape.z + clothU * 2.0);`,
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
  // The flukes (the design sheet's emblem path, 5×), a little below the middle.
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
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.anisotropy = 4;
  emblems.set(key, texture);
  return texture;
}

/** The owner's pennant, one flat colour. */
export function pennantMaterial(cloth: ClothBend, wind: Wind, color: string): MeshStandardMaterial {
  return bend(new MeshStandardMaterial({ color, roughness: 0.8, flatShading: true }), cloth, wind, 'pennant');
}

/** The ghost ship's rags at night: unlit, glowing (its colour pulses, set by `ShipModel`). */
export function glowMaterial(cloth: ClothBend, wind: Wind, color: string): MeshBasicMaterial {
  return bend(new MeshBasicMaterial({ color, toneMapped: false }), cloth, wind, 'glow');
}
