import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { IslandId, PlayerId } from '../../v07/game';
import { PLAYER_ISLAND_RADIUS, seatPosition } from '../../ui/scene/layout';
import { MARKET_GROUND } from '../../ui/scene/marketDocks';
import { MARKET_TOP } from '../../ui/scene/buildings/islands/market';
import type { Vec3 } from '../../ui/scene/buildings/polyhedra';
import { ISLAND_LABELS, ISLAND_TEXT, MARKET_ISLAND_LABEL, MARKET_ISLAND_TEXT } from '../labels';
import type { TablePin } from '../scene/TableCanvas';
import { IslandGlance } from './IslandGlance';
import { IslandIcon } from './IslandIcon';

// Each island's landmark icon and name as its own badge on the island, apart from the guild's name plate. Hover
// (desktop) or tap it to see what the island does (§11.2); tap elsewhere to close.

/** About how tall the tip is: it opens below the badge when there is not this much room above it. */
const TIP_ROOM = 230;

/**
 * Whether the tip should open below the badge: above it would run under the market strip at the top
 * of the screen (or off it), as it does for the islands at the back of the table.
 */
function opensBelow(badge: HTMLElement | null): boolean {
  if (!badge) return false;
  const top = badge.getBoundingClientRect().top;
  const hud = document.querySelector('.inv-market')?.getBoundingClientRect().bottom ?? 0;
  return top - TIP_ROOM < hud + 8;
}

/** A name badge on the table that opens a tip when hovered (desktop) or tapped; tap elsewhere to close. */
function TableBadge({ name, tip }: { readonly name: ReactNode; readonly tip: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [below, setBelow] = useState(false);
  const self = useRef<HTMLSpanElement>(null);
  const place = () => setBelow(opensBelow(self.current));
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!self.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <span ref={self} className={`island-badge ${open ? 'open' : ''} ${below ? 'below' : ''}`} onPointerEnter={place}>
      <button
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          place();
          setOpen((v) => !v);
        }}
      >
        {name}
      </button>
      <span className="island-tip" role="tooltip">
        {tip}
      </span>
    </span>
  );
}

export function IslandBadge({ island }: { readonly island: IslandId }) {
  const text = ISLAND_TEXT[island];
  const name = (
    <>
      <IslandIcon island={island} />
      {ISLAND_LABELS[island]}
    </>
  );
  return (
    <TableBadge
      name={name}
      tip={
        <>
          <b>{name}</b>
          <IslandGlance island={island} />
          <span className="draft-full">
            <span>{text.pro}</span>
            <span>{text.con}</span>
          </span>
        </>
      }
    />
  );
}

/** The market island's name badge: where every ship sails to sell (§1, §7). */
export function MarketBadge() {
  return (
    <TableBadge
      name={MARKET_ISLAND_LABEL}
      tip={
        <>
          <b>{MARKET_ISLAND_LABEL}</b>
          <span>{MARKET_ISLAND_TEXT}</span>
        </>
      }
    />
  );
}

/**
 * The market badge floats like a sign just over the bazaar's bell frame: every bearing round the island
 * is taken by some seat's berth (three or four players), the brokers' badges or the market card.
 */
export const MARKET_BADGE_AT: Vec3 = [0, MARKET_GROUND + MARKET_TOP + 1.2, 0];

export function marketBadgePin(): TablePin {
  return { id: 'market-island', position: MARKET_BADGE_AT, node: <MarketBadge /> };
}

/**
 * Where an island's badge goes: at the island's back edge (the top of it on screen), clear of its plate
 * and dock; on an island at the side of the table, whose backdrop stands at that back edge, just past
 * its outer rim instead, clear of its buildings, so the badge never covers the backdrop (the mine's railway).
 */
export function badgePosition(angle: number): Vec3 {
  const [x, , z] = seatPosition(angle);
  const edge = PLAYER_ISLAND_RADIUS * 0.72;
  // Past the rim of a side island, over the sea, clear of the buildings near its edge.
  const outside = PLAYER_ISLAND_RADIUS * 1.1;
  return Math.abs(x) > Math.abs(z) ? [x + Math.sign(x) * outside, 4, z] : [x, 4, z - edge];
}

/**
 * An island at the side of the table: its badge would land on its own name plate (the plate hangs in
 * front of it and reaches up the screen), so the badge rides on top of the plate instead (`seatPlates`).
 */
export function isSideSeat(angle: number): boolean {
  const [x, , z] = seatPosition(angle);
  return Math.abs(x) > Math.abs(z);
}

/** Badges on the near and far islands, clear of plates, docks and backdrops (`badgePosition`); side islands' ride on their plates. */
export function islandBadgePins(
  seats: readonly { readonly id: PlayerId }[],
  angles: readonly number[],
  islandOf: (id: PlayerId) => IslandId | null,
): TablePin[] {
  return seats.flatMap((s, i): TablePin[] => {
    const island = islandOf(s.id);
    if (!island || isSideSeat(angles[i]!)) return [];
    return [{ id: `island-${s.id}`, position: badgePosition(angles[i]!), node: <IslandBadge island={island} /> }];
  });
}
