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
} as const satisfies Record<string, Swatch>;
export type Mat = keyof typeof SWATCHES;
