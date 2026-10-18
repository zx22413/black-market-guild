// Small hand-made touches for the island cards (docs/ui/v07-style-layers.md): a torn edge and a lean
// that differ per card but never change between visits, and the tilt that follows the pointer.
// Pure: no DOM, no Math.random (the variation comes from the card's id).

/** A small string hash (FNV-1a), the seed of a card's variation. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A tiny seeded generator of numbers in [0, 1) (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RoughEdgeOptions {
  /** How far the edge may bite into the card, in percent of its size. */
  readonly depth?: number;
  /** Points per side. */
  readonly steps?: number;
}

const round = (v: number): number => Math.round(v * 100) / 100;

/**
 * A CSS `clip-path` polygon that nibbles the card's edge like rough paper: points go clockwise from the
 * top left, each pushed inward by up to `depth` percent. The same id always gives the same edge.
 */
export function roughEdge(id: string, { depth = 0.9, steps = 9 }: RoughEdgeOptions = {}): string {
  const next = seeded(hash(id));
  const bite = (): number => round(next() * depth);
  const along = (i: number): number => round((i / steps) * 100);
  const out: string[] = [];
  for (let i = 0; i < steps; i++) out.push(`${along(i)}% ${bite()}%`);
  for (let i = 0; i < steps; i++) out.push(`${round(100 - bite())}% ${along(i)}%`);
  for (let i = 0; i < steps; i++) out.push(`${round(100 - along(i))}% ${round(100 - bite())}%`);
  for (let i = 0; i < steps; i++) out.push(`${bite()}% ${round(100 - along(i))}%`);
  return `polygon(${out.join(', ')})`;
}

/** The card's fixed lean in degrees, within ±1.5. */
export function cardLean(id: string): number {
  return round((seeded(hash(`lean:${id}`))() * 2 - 1) * 1.5);
}

export interface Tilt {
  /** Degrees; positive tips the top away. */
  readonly rotateX: number;
  /** Degrees; positive turns the right side away. */
  readonly rotateY: number;
  /** Where the foil's glare sits, in percent of the card. */
  readonly glareX: number;
  readonly glareY: number;
}

/**
 * The tilt for a pointer at (x, y) on a card of `width` × `height`: the corner under the pointer is
 * pressed away by up to `max` degrees, and the glare follows the pointer.
 */
export function pointerTilt(x: number, y: number, width: number, height: number, max: number): Tilt {
  if (width <= 0 || height <= 0) return { rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 };
  const u = Math.min(1, Math.max(0, x / width));
  const v = Math.min(1, Math.max(0, y / height));
  return { rotateX: (0.5 - v) * 2 * max, rotateY: (u - 0.5) * 2 * max, glareX: u * 100, glareY: v * 100 };
}
