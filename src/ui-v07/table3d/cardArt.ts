import type { BuildingId, RoleId, VoyageEventId } from '../../v07/game';

// The card art of buildings, roles and voyage events (public/art/cards, docs/ui/v07-style-layers.md):
// an illustration for the card's picture window, and an icon drawn from it for every small badge,
// so a player who has seen the card knows its icon. Island art lives in public/art/islands.

export type CardArt =
  | { readonly kind: 'building'; readonly id: BuildingId }
  | { readonly kind: 'role'; readonly id: RoleId }
  | { readonly kind: 'voyage'; readonly id: VoyageEventId };

const base = (): string => `${import.meta.env.BASE_URL}art/cards`;

/** The card's illustration (400 × 300). */
export const cardArtUrl = ({ kind, id }: CardArt): string => `${base()}/${kind}-${id}.svg`;

/** The icon drawn from the illustration (64 × 64, no background). */
export const cardIconUrl = ({ kind, id }: CardArt): string => `${base()}/icons/${kind}-${id}.svg`;

/** V0.8 prototype: the events that have a dark-tide side with a picture of its own (the tides' own cards, TIDE_CARD). */
const BOSS_ART: ReadonlySet<VoyageEventId> = new Set<VoyageEventId>(['storm', 'sea-fog', 'black-market-rush', 'calm-seas']);

/** The illustration of a voyage event's dark-tide side (400 × 300); the event's own picture where none is drawn. */
export const bossArtUrl = (id: VoyageEventId): string => (BOSS_ART.has(id) ? `${base()}/voyage-${id}-boss.svg` : cardArtUrl({ kind: 'voyage', id }));
