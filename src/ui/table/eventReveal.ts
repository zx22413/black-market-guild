import type { MarketEventId, MatchEvent, VoyageEventId } from '../../game';

/** How long a revealed event card holds the screen before playback moves on. */
export const SHOWCASE_MS = 3000;

/** A market or voyage event shown full screen as it is revealed. */
export type Showcase =
  | { readonly kind: 'market'; readonly round: number; readonly event: MarketEventId }
  | { readonly kind: 'voyage'; readonly round: number; readonly event: VoyageEventId };

/** The card to show for an event, if it is a market or voyage reveal. */
export function showcaseOf(event: MatchEvent | undefined): Showcase | null {
  switch (event?.type) {
    case 'market-event-revealed':
      return { kind: 'market', round: event.round, event: event.event };
    case 'voyage-event-revealed':
      return { kind: 'voyage', round: event.round, event: event.event };
    default:
      return null;
  }
}
