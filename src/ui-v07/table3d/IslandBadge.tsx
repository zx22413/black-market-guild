import { useEffect, useRef, useState } from 'react';
import type { IslandId, PlayerId } from '../../v07/game';
import { PLAYER_ISLAND_RADIUS, seatPosition } from '../../ui/scene/layout';
import { ISLAND_LABELS, ISLAND_TEXT } from '../labels';
import type { TablePin } from '../scene/TableCanvas';
import { IslandGlance } from './IslandGlance';

// Each island's name as its own badge on the island, apart from the guild's name plate. Hover
// (desktop) or tap it to see what the island does (§11.2); tap elsewhere to close.

function IslandBadge({ island }: { readonly island: IslandId }) {
  const [open, setOpen] = useState(false);
  const self = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!self.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const text = ISLAND_TEXT[island];
  return (
    <span ref={self} className={`island-badge ${open ? 'open' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {ISLAND_LABELS[island]}
      </button>
      <span className="island-tip" role="tooltip">
        <b>{ISLAND_LABELS[island]}</b>
        <IslandGlance island={island} />
        <span className="draft-full">
          <span>{text.pro}</span>
          <span>{text.con}</span>
        </span>
      </span>
    </span>
  );
}

/** Badges at the back edge of each island (the top of it on screen), clear of plates and docks. */
export function islandBadgePins(
  seats: readonly { readonly id: PlayerId }[],
  angles: readonly number[],
  islandOf: (id: PlayerId) => IslandId | null,
): TablePin[] {
  return seats.flatMap((s, i): TablePin[] => {
    const island = islandOf(s.id);
    if (!island) return [];
    const [x, , z] = seatPosition(angles[i]!);
    return [{ id: `island-${s.id}`, position: [x, 4, z - PLAYER_ISLAND_RADIUS * 0.72], node: <IslandBadge island={island} /> }];
  });
}
