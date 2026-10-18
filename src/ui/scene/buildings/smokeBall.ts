import { IcosahedronGeometry, MeshStandardMaterial } from 'three';

// Low-poly balls of smoke, puffed out one after another: shared by the fires' smoke and the mine engine's.

/** A low-poly ball of radius 1, shared by every puff. */
export const PUFF_BALL = new IcosahedronGeometry(1, 1);

/** Steam-white smoke, and the greyer smoke of a wood fire that has to show against pale sand. */
export const STEAM_SMOKE = '#ece8e1';
export const WOOD_SMOKE = '#c9c4be';

/** One material per puff, each fading on its own; the caller disposes of them. */
export function smokeBallMaterials(count: number, color: string): MeshStandardMaterial[] {
  return Array.from({ length: count }, () => new MeshStandardMaterial({ color, roughness: 1, flatShading: true, transparent: true, depthWrite: false }));
}

/** How big a puff is, as a share of its full grown size, `k` of the way through its life: it pops out, then swells by `grow` times. */
export function puffSwell(k: number, grow: number): number {
  return Math.min(1, k / 0.06) * (1 + k * (grow - 1));
}

/** How solid a puff is `k` of the way through its life: thinning away to nothing as it swells, sooner the bigger `fade` is. */
export function puffOpacity(k: number, fade = 1.3): number {
  return 0.95 * Math.pow(1 - k, fade);
}
