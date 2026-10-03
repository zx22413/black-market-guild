import { useTexture } from '@react-three/drei';

/** Kenney Particle Pack sparkles (CC0; see public/art/SOURCES.md): soft glow, glint and four-point star. */
export const SPARKLES = ['star_05', 'star_06', 'star_07'].map((name) => `${import.meta.env.BASE_URL}art/particles/${name}.png`);

// Load them up front: a texture that suspends in the middle of a game would hide the whole table.
useTexture.preload(SPARKLES);
