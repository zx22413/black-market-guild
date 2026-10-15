import type { VoyageEventId } from '../../v07/game';
import { VOYAGE_EVENT_LABELS, VOYAGE_EVENT_TEXT } from '../labels';

// The voyage event (§5 step 5, §12) as the V0.6 event card: a parchment card flips in the middle
// of a darkened table, holds for its line to be read, then shrinks off to the top-left, where a
// small chip keeps the event in view for the rest of the round (instead of a line in the bar).

/** How long the card holds the screen before it shrinks away (ms). */
export const EVENT_CARD_MS = 3000;

const iconUrl = (event: VoyageEventId): string => `${import.meta.env.BASE_URL}art/icons/voyage-${event}.svg`;

export function VoyageEventCard({ event, round, onDone }: { readonly event: VoyageEventId; readonly round: number; readonly onDone: () => void }) {
  const title = VOYAGE_EVENT_LABELS[event];
  return (
    <div className="event-card-veil" style={{ animationDuration: `${EVENT_CARD_MS}ms` }} role="dialog" aria-label={`航海事件：${title}`} onClick={onDone}>
      <div className="event-card" style={{ animationDuration: `${EVENT_CARD_MS}ms` }} onAnimationEnd={onDone}>
        <small className="event-card-kind">第 {round} 回合・航海事件</small>
        <div className="event-card-emblem">
          <img src={iconUrl(event)} alt="" />
        </div>
        <strong>{title}</strong>
        <p>{VOYAGE_EVENT_TEXT[event]}</p>
        <small className="event-card-hint">點一下繼續</small>
      </div>
    </div>
  );
}

/** The card's small after-image in the top-left corner; hover (or focus) for its line. */
export function VoyageEventChip({ event }: { readonly event: VoyageEventId }) {
  return (
    <div className="event-chip" tabIndex={0} aria-label={`航海事件：${VOYAGE_EVENT_LABELS[event]}。${VOYAGE_EVENT_TEXT[event]}`}>
      <img src={iconUrl(event)} alt="" />
      <b>{VOYAGE_EVENT_LABELS[event]}</b>
      <span className="event-chip-tip">{VOYAGE_EVENT_TEXT[event]}</span>
    </div>
  );
}
