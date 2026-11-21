import { useEffect, useState } from 'react';
import { TIDE_CARD, type TideKind } from '../../v07/game';
import { soundEngine } from '../audio/soundEngine';
import { bossArtUrl, cardArtUrl } from './cardArt';
import type { RoundCard } from './roundCard';
import './roundCard.css';
import { TIDE_LABELS } from './tideModel';
import { TideIcon } from './tideIcons';

// V0.8 prototype (an experiment, not rules): the card a round turned up, one after another in the middle of a darkened
// table (the voyage event's card, VoyageEventCard, with the prototype's other cards): a voyage event (its boss side
// in the dark-tide season), 暗潮將至 with the tide picked from the two candidates, and the last round's card. A click
// moves on; left alone each card holds long enough to read its lines once. 暗潮將至 is the exception: it says a lot
// (what the round's end takes, then the forecast), so it stays until it is clicked, and so does the last round's card. The first dark-tide side of a
// match is not dealt face up: the event's plain card comes first and is turned over to its dark side (BossFlip).

/** How long each kind of card holds the screen (ms); 暗潮將至 and the last round's card stay until clicked, so theirs are not used by the show. */
export const ROUND_CARD_MS: Readonly<Record<RoundCard['kind'] | 'boss', number>> = { voyage: 3000, boss: 4200, rising: 6500, final: 5200 };
/** When 暗潮將至 shows which candidate it is (ms into the card); from then on a click closes it. */
const TIDE_PICK_MS = 1500;
/** How long the last round's card is up before a click closes it (ms): long enough that a stray click does not skip it. */
const FINAL_READY_MS = 800;
/** How long a card that was held takes to shrink away once clicked (ms; beat.css's event-leave). */
const LEAVE_MS = 600;
/** The first dark-tide side: how long the plain side shows before it is turned over, and the turn itself (ms; roundCard.css). */
const FLIP_AT_MS = 1500;
const FLIP_MS = 800;

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
        <img src={card.boss ? bossArtUrl(card.event) : cardArtUrl({ kind: 'voyage', id: card.event })} alt="" />
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

/**
 * The first dark-tide side of a match: the event's plain card flips in, holds, then turns over to the dark side (the
 * two faces back to back), which holds as long as any dark side does. A click moves on at any time.
 */
function BossFlip({ card, onDone }: { readonly card: Extract<RoundCard, { kind: 'voyage' }>; readonly onDone: () => void }) {
  const [phase, setPhase] = useState<'front' | 'back' | 'leave'>('front');
  useEffect(() => {
    const [ms, then] = phase === 'front' ? [FLIP_AT_MS, () => setPhase('back')] : phase === 'back' ? [FLIP_MS + ROUND_CARD_MS.boss, () => setPhase('leave')] : [LEAVE_MS, onDone];
    const timer = setTimeout(then, ms);
    return () => clearTimeout(timer);
    // `onDone` is the caller's current closure each render; the phase alone drives the show.
  }, [phase]);
  useEffect(() => {
    if (phase === 'back') soundEngine.playSfx('island-pop', 0.7);
  }, [phase]);
  const plain = card.flipFrom!;
  return (
    <div className={`event-card-veil round-veil-flip ${phase === 'leave' ? 'event-leave' : 'event-hold'} ${phase === 'front' ? '' : 'turned'}`} role="dialog" aria-label={`${KIND_TEXT(card)}：${card.title}`} onClick={onDone}>
      <div className="round-flip" data-focus="event">
        <div className="round-flip-inner">
          <div className="event-card round-card round-card-plain round-flip-face" aria-hidden={phase !== 'front'}>
            <small className="event-card-kind">航海事件</small>
            <div className="event-card-emblem">
              <img src={cardArtUrl({ kind: 'voyage', id: card.event })} alt="" />
            </div>
            <strong>{plain.title}</strong>
            {plain.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="event-card round-card round-card-boss round-flip-face round-flip-back" aria-hidden={phase === 'front'}>
            <small className="event-card-kind">{KIND_TEXT(card)}</small>
            <Face card={card} />
          </div>
        </div>
      </div>
    </div>
  );
}

const KIND_TEXT = (card: RoundCard): string => (card.kind === 'voyage' ? (card.boss ? '航海事件・暗潮面' : '航海事件') : card.kind === 'rising' ? '暗潮' : '終局');

export function RoundCardShow({ cards, onDone }: { readonly cards: readonly RoundCard[]; readonly onDone: () => void }) {
  const [at, setAt] = useState(0);
  // A held card (暗潮將至, the last round): 'hold' until it may be closed, 'ready' once a click closes it, 'leave' while it shrinks away.
  const [held, setHeld] = useState<'hold' | 'ready' | 'leave'>('hold');
  const card = cards[at];
  const holds = card?.kind === 'rising' || card?.kind === 'final';
  const next = () => {
    setHeld('hold');
    if (at + 1 < cards.length) setAt(at + 1);
    else onDone();
  };
  useEffect(() => {
    if (!holds || held === 'ready') return undefined;
    const timer = setTimeout(held === 'hold' ? () => setHeld('ready') : next, held === 'hold' ? (card?.kind === 'final' ? FINAL_READY_MS : TIDE_PICK_MS) : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [holds, held, at]);
  if (!card) return null;
  if (card.kind === 'voyage' && card.boss && card.flipFrom) return <BossFlip key={at} card={card} onDone={next} />;
  if (holds) {
    return (
      <div
        key={at}
        className={`event-card-veil round-veil-${card.kind} round-veil-held ${held === 'leave' ? 'event-leave' : 'event-hold'} ${held === 'ready' ? 'ready' : ''}`}
        role="dialog"
        aria-label={`${KIND_TEXT(card)}：${card.title}`}
        onClick={() => held === 'ready' && setHeld('leave')}
      >
        <div className={`event-card round-card round-card-${card.kind}`} data-focus="event">
          <small className="event-card-kind">{KIND_TEXT(card)}</small>
          <Face card={card} />
        </div>
        <p className="tap-hint round-card-tap" data-focus="tap" aria-hidden={held !== 'ready'}>
          點任意處關閉
        </p>
      </div>
    );
  }
  // Only voyage events are left: they close by themselves.
  const ms = ROUND_CARD_MS[card.boss ? 'boss' : 'voyage'];
  const style = { animationDuration: `${ms}ms` };
  const tone = card.boss ? 'boss' : 'plain';
  return (
    <div key={at} className={`event-card-veil event-auto round-veil-${tone}`} style={style} role="dialog" aria-label={`${KIND_TEXT(card)}：${card.title}`} onClick={next}>
      <div className={`event-card round-card round-card-${tone}`} data-focus="event" style={style} onAnimationEnd={(e) => { if (e.animationName === 'event-card' || e.animationName === 'event-veil') next(); }}>
        <small className="event-card-kind">{KIND_TEXT(card)}</small>
        <Face card={card} />
      </div>
    </div>
  );
}
