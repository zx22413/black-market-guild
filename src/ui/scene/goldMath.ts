import { TARGET_ISLAND_HEIGHT } from './islandShape';
import { TARGET_ISLAND_RADIUS } from './layout';

/** Sparkle sprites a mote can use: soft glow, glint and four-point star (see `public/art/particles`). */
export const MOTE_KINDS = 3;

/** One gold mote rising over the table during a black market rush. */
export interface Mote {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Rise speed, units per second. */
  readonly rise: number;
  /** Sideways drift as it rises, and the phase of that drift. */
  readonly sway: number;
  readonly swayPhase: number;
  /** Seconds from appearing to fading out. */
  readonly life: number;
  readonly size: number;
  readonly kind: number;
  /** Spin, radians per second. */
  readonly spin: number;
}

/** Share of motes that rise around the black market port; the rest are scattered over the table. */
const NEAR_PORT = 0.72;
const PORT_SPREAD = 26;
/** Share of the port's motes that rise from the market's terraces, how far out, and how high up its tiers they start. */
const OVER_MARKET = 0.4;
const MARKET_SPREAD = 8;
const MARKET_TIERS = 6;
const TABLE = { x: 85, z: 65 } as const;

/** A new gold mote: mostly around the port in the middle, starting on the plateau or the sea surface. */
export function spawnMote(random: () => number): Mote {
  let x: number;
  let z: number;
  let overMarket = false;
  if (random() < NEAR_PORT) {
    // A good share rise straight off the market's terraces, thickest over the bazaar itself.
    overMarket = random() < OVER_MARKET;
    const a = random() * Math.PI * 2;
    const r = (overMarket ? MARKET_SPREAD : PORT_SPREAD) * Math.sqrt(random());
    x = Math.cos(a) * r;
    z = Math.sin(a) * r;
  } else {
    x = (random() * 2 - 1) * TABLE.x;
    z = (random() * 2 - 1) * TABLE.z;
  }
  const onPort = Math.hypot(x, z) < TARGET_ISLAND_RADIUS;
  return {
    x,
    y: overMarket ? TARGET_ISLAND_HEIGHT + 0.6 + random() * MARKET_TIERS : onPort ? TARGET_ISLAND_HEIGHT + 0.6 + random() * 1.5 : 0.2 + random() * 0.4,
    z,
    rise: 1 + random() * 1.2,
    sway: 0.3 + random() * 0.6,
    swayPhase: random() * Math.PI * 2,
    life: 3 + random() * 2,
    // The sparkle sprites only light their middle, so a mote is drawn much larger than it looks.
    size: 3 + random() * 3,
    kind: Math.floor(random() * MOTE_KINDS),
    spin: (random() - 0.5) * 1.6,
  };
}
