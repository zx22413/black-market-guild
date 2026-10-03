import type { WebGLProgramParametersWithUniforms } from 'three';

/** Uniforms the construction effect drives each frame; shared by reference with the shader. */
export interface GoldGlow {
  /** 0 = plain building, 1 = fully gold and glowing. */
  readonly uGlow: { value: number };
  /** Seconds, for the band of light that runs up the walls. */
  readonly uTime: { value: number };
}

export function createGoldGlow(): GoldGlow {
  return { uGlow: { value: 0 }, uTime: { value: 0 } };
}

/**
 * Patches a standard material so a building under construction looks like molten gold: the base
 * color is pulled toward gold, a band of light runs up the walls, and the silhouette rims bright.
 */
export function goldGlowPatch(glow: GoldGlow) {
  return (shader: WebGLProgramParametersWithUniforms): void => {
    shader.uniforms['uGlow'] = glow.uGlow;
    shader.uniforms['uTime'] = glow.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlow;\nuniform float uTime;\nvarying float vLocalY;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 goldTint = vec3(1.0, 0.66, 0.12);
        diffuseColor.rgb = mix(diffuseColor.rgb, goldTint * 0.85, 0.6 * uGlow);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float band = 0.5 + 0.5 * sin(vLocalY * 5.0 - uTime * 7.0);
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0);
        totalEmissiveRadiance += goldTint * uGlow * (0.12 + 0.3 * band + 0.55 * rim);`,
      );
  };
}
