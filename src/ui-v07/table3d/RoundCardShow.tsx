import { useEffect, useState } from 'react';
import { TIDE_CARD, type TideKind } from '../../v07/game';
import { soundEngine } from '../audio/soundEngine';
import { cardArtUrl } from './cardArt';
import type { RoundCard } from './roundCard';
import './roundCard.css';
import { TIDE_LABELS } from './tideModel';
import { TideIcon } from './tideIcons';

// V0.8 prototype (an experiment, not rules): the card a round turned up, one after another in the middle of a darkened
// table (the voyage event's card, VoyageEventCard, with the prototype's other cards): a voyage event (its boss side
// in the dark-tide season), 暗潮將至 with the tide picked from the two candidates, and the last round's card. A click
// moves on; left alone each card holds long enough to read its lines once.

/** How long each kind of card holds the screen (ms): 暗潮將至 first turns the two candidates over. */
export const ROUND_CARD_MS: Readonly<Record<RoundCard['kind'] | 'boss', number>> = { voyage: 3000, boss: 4200, rising: 6500, final: 5200 };
/** When 暗潮將至 shows which candidate it is (ms into the card). */
const TIDE_PICK_MS = 1500;

function Rising({ card }: { readonly card: Extract<RoundCard, { kind: 'rising' }> }) {
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setPicked(true);
      soundEngine.playSfx('island-pop', 0.6);
    }, TIDE_PICK_MS);
    return () => clearTimeout(timer);
  }, []);
  const kinds: readonly TideKind[] = card.candidates.length > 0 ? card.candidates : card.tide ? [card.tide] : [];
  return (
    <>
      <div className={`round-card-tides ${picked ? 'picked' : ''}`}>
        {kinds.map((kind) => (
          <span key={kind} className={`round-card-tide ${kind === card.tide ? 'is' : 'not'}`}>
            <TideIcon kind={kind} />
            <b>{TIDE_LABELS[kind]}</b>
          </span>
        ))}
      </div>
      <strong>{card.title}</strong>
      <ul className={picked ? 'picked' : ''}>
        {card.lines.map((line, i) => (
          <li key={line} className={i === 0 ? '' : 'after-pick'}>
            {/* The first line happens as this round ends; the rest only start next round, so they are marked a forecast. */}
            {i <= 1 && <em className={`round-card-when ${i === 0 ? 'now' : 'forecast'}`}>{i === 0 ? '本回合結束' : '預告'}</em>}
            {line}
          </li>
        ))}
      </ul>
    </>
  );
}

function Face({ card }: { readonly card: RoundCard }) {
  if (card.kind === 'rising') return <Rising card={card} />;
  if (card.kind === 'final') {
    return (
      <>
        <div className="round-card-final" aria-hidden="true">
          終
        </div>
        <strong>{card.title}</strong>
        <ul>
          {card.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </>
    );
  }
  const tide = card.boss ? ((Object.keys(TIDE_CARD) as TideKind[]).find((k) => TIDE_CARD[k] === card.event) ?? null) : null;
  return (
    <>
      <div className="event-card-emblem">
        <img src={cardArtUrl({ kind: 'voyage', id: card.event })} alt="" />
        {tide && (
          <span className="round-card-boss">
            <TideIcon kind={tide} wave={false} />
          </span>
        )}
      </div>
      <strong>{card.title}</strong>
      {card.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </>
  );
}

const KIND_TEXT = (card: RoundCard): string => (card.kind === 'voyage' ? (card.boss ? '航海事件・暗潮面' : '航海事件') : card.kind === 'rising' ? '暗潮' : '終局');

export function RoundCardShow({ cards, onDone }: { readonly cards: readonly RoundCard[]; readonly onDone: () => void }) {
  const [at, setAt] = useState(0);
  const card = cards[at];
  const next = () => (at + 1 < cards.length ? setAt(at + 1) : onDone());
  if (!card) return null;
  const ms = ROUND_CARD_MS[card.kind === 'voyage' && card.boss ? 'boss' : card.kind];
  const style = { animationDuration: `${ms}ms` };
  const tone = card.kind === 'voyage' ? (card.boss ? 'boss' : 'plain') : card.kind;
  return (
    <div key={at} className={`event-card-veil event-auto round-veil-${tone}`} style={style} role="dialog" aria-label={`${KIND_TEXT(card)}：${card.title}`} onClick={next}>
      <div className={`event-card round-card round-card-${tone}`} data-focus="event" style={style} onAnimationEnd={(e) => { if (e.animationName === 'event-card' || e.animationName === 'event-veil') next(); }}>
        <small className="event-card-kind">{KIND_TEXT(card)}</small>
        <Face card={card} />
      </div>
    </div>
  );
}
