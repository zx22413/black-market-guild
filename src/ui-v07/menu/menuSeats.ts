import type { MenuStage } from './menuShots';

// What each island of the menu table shows on each menu page: a flag in its guild color, mist over
// a seat nobody has taken, and what its ship is doing. In the lobby the islands mirror the seat
// cards, so friends sitting down raise their flags on the table.

export type MenuSeat = { readonly kind: 'member'; readonly name: string } | { readonly kind: 'empty' };

export interface MenuView {
  readonly stage: MenuStage;
  /** Lobby only: the seat cards in order (members, then open seats up to the seat count). */
  readonly seats?: readonly MenuSeat[];
  /** Launch only: how many seats the starting match has. */
  readonly seatCount?: number;
}

/** shuttle: to the market and back; waiting: at its dock with a lit lantern; docked: at its dock; launch: sailing out with the others. */
export type MenuShipMode = 'shuttle' | 'waiting' | 'docked' | 'launch' | 'hidden';

export interface MenuSeatLook {
  readonly flag: boolean;
  readonly mist: boolean;
  readonly ship: MenuShipMode;
  /** A plate over the island (lobby only). */
  readonly label: string | null;
}

const PLAIN: MenuSeatLook = { flag: false, mist: false, ship: 'shuttle', label: null };
const OUT_OF_MATCH: MenuSeatLook = { flag: false, mist: true, ship: 'hidden', label: null };

function lobbyLook(seat: MenuSeat | undefined): MenuSeatLook {
  if (!seat) return OUT_OF_MATCH;
  return seat.kind === 'member' ? { flag: true, mist: false, ship: 'docked', label: seat.name } : { flag: false, mist: true, ship: 'hidden', label: '電腦補上' };
}

/** The look of each of the `count` menu islands; island 0 is yours. */
export function menuSeatLooks(view: MenuView, count: number): MenuSeatLook[] {
  return Array.from({ length: count }, (_, i): MenuSeatLook => {
    switch (view.stage) {
      case 'title':
      case 'tutorial':
        return PLAIN;
      case 'local':
        return i === 0 ? { ...PLAIN, ship: 'waiting' } : PLAIN;
      case 'online':
        return { ...PLAIN, flag: true };
      case 'lobby':
        return lobbyLook(view.seats?.[i]);
      case 'launch':
        return i < (view.seatCount ?? count) ? { ...PLAIN, flag: true, ship: 'launch' } : { ...PLAIN, ship: 'hidden' };
    }
  });
}
