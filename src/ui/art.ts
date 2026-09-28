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
