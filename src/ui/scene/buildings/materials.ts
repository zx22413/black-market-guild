/** A material: shaded from `top` to `bottom` across each solid's height. */
export interface Swatch {
  readonly top: string;
  readonly bottom: string;
}

/**
 * Gradient swatches sampled from the Kenney Pirate Kit colormap (public/models/pirate-kit,
 * CC0), so hand-built models share the rest of the table's palette and its hue-shifting shade.
 * Add a swatch here, sampled from that colormap, rather than coloring a part directly; see
 * docs/art/lowpoly-style.md.
 */
export const SWATCHES = {
  plaster: { top: '#fce2c4', bottom: '#f3ca98' },
  marble: { top: '#fbfbfd', bottom: '#bebed6' },
  stone: { top: '#c1caf2', bottom: '#797e97' },
  slate: { top: '#84899f', bottom: '#636378' },
  wood: { top: '#ed946a', bottom: '#b36343' },
  woodDark: { top: '#ad5f41', bottom: '#845442' },
  dark: { top: '#464650', bottom: '#353539' },
  metal: { top: '#535666', bottom: '#3b3e4a' },
  rope: { top: '#f0bc96', bottom: '#ca845c' },
  brass: { top: '#ff9b44', bottom: '#ff7344' },
  gold: { top: '#ffd263', bottom: '#ffc044' },
  roofRed: { top: '#fc6c41', bottom: '#d1544e' },
  roofBlue: { top: '#6691d7', bottom: '#5857bd' },
  roofGreen: { top: '#5dc789', bottom: '#1c856a' },
  roofGold: { top: '#ffd263', bottom: '#ff952f' },
  // Island landmarks (landmarks.ts); none of them is one of the four asset roof colors.
  sandstone: { top: '#f2bf99', bottom: '#ca845c' },
  mace: { top: '#cf534f', bottom: '#cf534f' },
  spiceYellow: { top: '#ffc044', bottom: '#ffc044' },
  spiceOrange: { top: '#ff7e44', bottom: '#ff7e44' },
  cardamom: { top: '#61cb8b', bottom: '#61cb8b' },
  leaf: { top: '#5dc789', bottom: '#1c856a' },
  basalt: { top: '#65657a', bottom: '#41414a' },
  // The islands' sand (IslandBase's default cliff), so a beach on a landmark meets the ground it lies on.
  sand: { top: '#e2c28a', bottom: '#e2c28a' },
  // Treasure that glows on the table (`GLOWING_MATS`): gold coin and silver plate.
  treasure: { top: '#ffd263', bottom: '#ffc044' },
  silver: { top: '#fbfbfd', bottom: '#bebed6' },
  ruby: { top: '#fc6c41', bottom: '#cf534f' },
  emerald: { top: '#61cb8b', bottom: '#1c856a' },
  // Embers under a fire, glowing like the treasure.
  ember: { top: '#ffc044', bottom: '#ff7344' },
  heather: { top: '#9064d9', bottom: '#6743bf' },
} as const satisfies Record<string, Swatch>;
export type Mat = keyof typeof SWATCHES;

/** Materials drawn unlit and pulsing (`Landmark`), so treasure glints even in the shade or at night. */
export const GLOWING_MATS: ReadonlySet<Mat> = new Set<Mat>(['treasure', 'silver', 'ruby', 'emerald', 'ember']);
