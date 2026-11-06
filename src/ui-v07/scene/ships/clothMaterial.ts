import { MeshBasicMaterial, MeshStandardMaterial, Vector3, type Material } from 'three';
import type { SailCloth } from './cloth';

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
function bend<M extends Material>(material: M, cloth: ClothBend, wind: Wind, kind: string): M {
  const [u0, u1] = cloth.span.u;
  const uniforms = {
    uClothTime: CLOTH_TIME,
    uWind: wind,
    uClothSpan: { value: new Vector3(u0, Math.max(u1 - u0, 1e-3), Math.max(cloth.span.w, 1e-3)) },
    uClothShape: { value: new Vector3(cloth.belly, cloth.flutter, cloth.phase) },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uClothTime;\nuniform float uWind;\nuniform vec3 uClothSpan;\nuniform vec3 uClothShape;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float clothU = clamp((transformed.x - uClothSpan.x) / uClothSpan.y * 2.0 - 1.0, -1.0, 1.0);
        float clothV = clamp(transformed.z / uClothSpan.z, 0.0, 1.0);
        float clothGust = 0.82 + 0.18 * sin(uClothTime * 1.3 + uClothShape.z);
        transformed.y += (0.35 + 0.65 * uWind) * uClothShape.x * (1.0 - clothU * clothU) * sin(3.14159 * clothV) * clothGust;
        transformed.y += uClothShape.y * clothV * sin(clothV * 5.0 - uClothTime * (3.0 + 3.0 * uWind) + uClothShape.z + clothU * 2.0);`,
      );
  };
  material.customProgramCacheKey = () => `ship-cloth-${kind}`;
  return material;
}

/** A sail in its swatch colours (vertex colours), lit like the rest of the ship; flat shading follows the bent cloth, so its belly catches the light. */
export function sailMaterial(cloth: ClothBend, wind: Wind): MeshStandardMaterial {
  return bend(new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), cloth, wind, 'sail');
}

/** The owner's pennant, one flat colour. */
export function pennantMaterial(cloth: ClothBend, wind: Wind, color: string): MeshStandardMaterial {
  return bend(new MeshStandardMaterial({ color, roughness: 0.8, flatShading: true }), cloth, wind, 'pennant');
}

/** The ghost ship's rags at night: unlit, glowing (its colour pulses, set by `ShipModel`). */
export function glowMaterial(cloth: ClothBend, wind: Wind, color: string): MeshBasicMaterial {
  return bend(new MeshBasicMaterial({ color, toneMapped: false }), cloth, wind, 'glow');
}
