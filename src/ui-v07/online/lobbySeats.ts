import type { RoomMemberInfo } from '../../v07/online';

// The lobby's seat cards: who has sat down, in join order, then the open seats that bots fill
// when the host starts.

export type SeatCard = ({ readonly kind: 'member' } & RoomMemberInfo) | { readonly kind: 'empty' };

/** The members in join order, then open seats up to `seats` (never fewer cards than members). */
export function seatCards(members: readonly RoomMemberInfo[], seats: number): SeatCard[] {
  const empty = Math.max(0, seats - members.length);
  return [...members.map((m): SeatCard => ({ kind: 'member', ...m })), ...Array.from({ length: empty }, (): SeatCard => ({ kind: 'empty' }))];
}
