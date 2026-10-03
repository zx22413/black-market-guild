import type { AssetId, MarketEventId, RoleId, VoyageEventId } from '../game';

/**
 * Placeholder art registry. Icons live in public/art/icons/<key>.svg and paintings in
 * public/art/paintings/<key>.jpg; sources and licenses are listed in public/art/SOURCES.md.
 * Every key has a text glyph fallback so the UI works before (or without) the files.
 */
export const ICON_FALLBACKS = {
  'ship-solo': '⛵',
  'ship-joint': '🚢',
  'ship-sunk': '🌊',
  'ship-arrived': '⚓',
  'role-intel': '🔭',
  'role-guard': '🛡',
  'role-pirate': '☠',
  'role-smuggler': '📦',
  'asset-shipyard': '🔨',
  'asset-insurance': '📜',
  'asset-salvage': '🪝',
  'asset-exchange': '⚖',
  'market-royal-joint-order': '👑',
  'market-private-trade-charter': '✉',
  'market-black-market-bounty': '💀',
  'market-sea-danger-warning': '⚠',
  'market-luxury-boom': '💎',
  'market-salvage-boom': '🧰',
  'voyage-tailwind': '🌬',
  'voyage-storm': '⛈',
  'voyage-sea-fog': '🌫',
  'voyage-moonless-night': '🌑',
  'voyage-high-waves': '🌊',
  'voyage-black-market-rush': '💰',
  'voyage-calm-seas': '☀',
  coin: '🪙',
  dice: '🎲',
  handshake: '🤝',
  reroll: '🔄',
} as const;

export type IconKey = keyof typeof ICON_FALLBACKS;

export const roleIcon = (role: RoleId): IconKey => `role-${role}`;
export const assetIcon = (asset: AssetId): IconKey => `asset-${asset}`;
export const marketIcon = (event: MarketEventId): IconKey => `market-${event}`;
export const voyageIcon = (event: VoyageEventId): IconKey => `voyage-${event}`;

export const PAINTINGS = ['harbor', 'merchant-ship', 'storm', 'high-waves', 'battle', 'calm-sea', 'night-sea'] as const;
export type PaintingKey = (typeof PAINTINGS)[number];

const base = import.meta.env.BASE_URL;
export const iconUrl = (key: IconKey): string => `${base}art/icons/${key}.svg`;
export const sourcesUrl = `${base}art/SOURCES.md`;
export const paintingUrl = (key: PaintingKey): string => `${base}art/paintings/${key}.jpg`;

/**
 * Hand-drawn UI parts: drawn as SVG by `npm run art:ui` (scripts/draw-ui-art.ts), then rendered
 * to 2× (`<key>.png`) and 3× (`<key>@3x.png`) images by `npm run art:ui:png`
 * (scripts/raster-ui-art.ts, then scripts/webp-ui-art.py for the paper-grained parts). The page
 * uses those images, not the SVGs: the SVGs' grain filters are re-run on every paint at a new
 * size, which stalls a frame. Both densities are offered, so each screen loads one.
 */
export const UI_ART = ['frame-wood', 'board-wood', 'paper', 'paper-small', 'plaque', 'button-arrow', 'button-tag', 'button-round', 'rope', 'rope-mask-outer', 'rope-mask-inner', 'icon-pencil', 'icon-plus'] as const;
export type UiArtKey = (typeof UI_ART)[number];
/**
 * Parts with paper grain ship as WebP: PNG cannot compress the grain. Keep in step with
 * `WEBP_PARTS` in scripts/webp-ui-art.py, which writes them.
 */
const UI_ART_WEBP: ReadonlySet<UiArtKey> = new Set(['paper', 'paper-small', 'plaque']);
const uiArtFile = (key: UiArtKey, suffix: string): string =>
  `${base}art/ui/${key}${suffix}.${UI_ART_WEBP.has(key) ? 'webp' : 'png'}`;
export const uiArtUrl = (key: UiArtKey): string => uiArtFile(key, '');
const uiArt3xUrl = (key: UiArtKey): string => uiArtFile(key, '@3x');

/** `<img>` props for a UI part: shown at the SVG's size, from the 2× or 3× file to suit the screen. */
export const uiArtImage = (key: UiArtKey): { readonly src: string; readonly srcSet: string } => ({
  src: uiArtUrl(key),
  srcSet: `${uiArtUrl(key)} 2x, ${uiArt3xUrl(key)} 3x`,
});

/**
 * The UI parts as CSS custom properties (`--ui-frame-wood` …), for border-image and backgrounds.
 * Declared by density with `image-set`, so border-image slices stay in the SVG's units. Written
 * with the `-webkit-` prefix on purpose: Safari before 17 (older iOS web views) only knows that
 * spelling, and an unknown value would drop every border-image, while all current browsers accept it.
 */
export const uiArtVars = (): Record<string, string> =>
  Object.fromEntries(
    UI_ART.map((key) => [`--ui-${key}`, `-webkit-image-set(url(${uiArtUrl(key)}) 2x, url(${uiArt3xUrl(key)}) 3x)`]),
  );

/** A render of the table itself (our own capture), used behind menus. */
export const uiBackdropUrl = `${base}art/ui/table-backdrop.jpg`;
