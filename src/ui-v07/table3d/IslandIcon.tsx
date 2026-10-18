import type { IslandId } from '../../v07/game';
import { ISLAND_LABELS } from '../labels';
import './islandCard.css';

// An island's landmark as an icon, drawn from its card's picture (public/art/islands/icons, see
// docs/ui/v07-style-layers.md): the same shapes and colours, so a player who has seen the card
// knows the island on the table. Shown in colour on a small sky-and-sea disc with a gold rim (the
// island's name plate, the ranking, the reveal). The files have no background, so a one-colour
// silhouette for chips can be made later with a CSS mask.

export const islandIconUrl = (island: IslandId): string => `${import.meta.env.BASE_URL}art/islands/icons/${island}.svg`;

export interface IslandIconProps {
  readonly island: IslandId;
  /** Shown as the tooltip and read out; leave out where the island's name is already next to it. */
  readonly label?: boolean;
}

export function IslandIcon({ island, label = false }: IslandIconProps) {
  const name = ISLAND_LABELS[island];
  const a11y = label ? { role: 'img', 'aria-label': name, title: name } : { 'aria-hidden': true };
  return (
    <span className="isle-icon" {...a11y}>
      <img src={islandIconUrl(island)} alt="" draggable={false} />
    </span>
  );
}
