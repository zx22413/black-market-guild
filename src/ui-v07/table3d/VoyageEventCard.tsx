import { useState } from 'react';
import type { VoyageEventId } from '../../v07/game';
import { VOYAGE_EVENT_LABELS, VOYAGE_EVENT_TEXT } from '../labels';
import { cardArtUrl, cardIconUrl } from './cardArt';

// The voyage event (§5 step 5, §12) as a card with its picture (cardArt.ts): it flips in the middle
// of a darkened table, holds for its line to be read, then shrinks off to the top-left, where a
// small chip keeps the event in view for the rest of the round (instead of a line in the bar).

/** How long the card holds the screen before it shrinks away (ms). */
export const EVENT_CARD_MS = 3000;

const iconUrl = (event: VoyageEventId): string => cardIconUrl({ kind: 'voyage', id: event });

/**
 * `held` freezes the card open (the tutorial explains it); once released it shrinks away on its own,
 * from the held pose, instead of replaying the whole show.
 */
export function VoyageEventCard({ event, held = false, onDone }: { readonly event: VoyageEventId; readonly held?: boolean; readonly onDone: () => void }) {
  const title = VOYAGE_EVENT_LABELS[event];
  const [wasHeld, setWasHeld] = useState(held);
  if (held && !wasHeld) setWasHeld(true);
  const mode = held ? 'hold' : wasHeld ? 'leave' : 'auto';
  const style = mode === 'auto' ? { animationDuration: `${EVENT_CARD_MS}ms` } : undefined;
  return (
    <div className={`event-card-veil event-${mode}`} style={style} role="dialog" aria-label={`航海事件：${title}`} onClick={held ? undefined : onDone}>
      <div className="event-card" data-focus="event" style={style} onAnimationEnd={(e) => { if (mode !== 'hold' && e.animationName !== 'event-card-in') onDone(); }}>
        <small className="event-card-kind">航海事件</small>
        <div className="event-card-emblem">
          <img src={cardArtUrl({ kind: 'voyage', id: event })} alt="" />
        </div>
        <strong>{title}</strong>
        <p>{VOYAGE_EVENT_TEXT[event]}</p>
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
