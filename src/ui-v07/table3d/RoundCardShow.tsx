import { useEffect, useState, type CSSProperties } from 'react';
import { TIDE_CARD, type FinalRoundEffect, type TideKind } from '../../v07/game';
import { soundEngine } from '../audio/soundEngine';
import { bossArtUrl, cardArtUrl, finalArtUrl } from './cardArt';
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
        <div className="event-card-emblem">
          <img src={finalArtUrl(card.effect)} alt="" />
          <span className="round-card-final" aria-hidden="true">
            終
          </span>
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
    <div className={`event-card-veil round-veil-flip ${phase === 'leave' ? 'event-leave' : 'event-hold'} ${phase === 'front' ? '' : 'turned'}`} data-fx="flip" role="dialog" aria-label={`${KIND_TEXT(card)}：${card.title}`} onClick={onDone}>
      <CardFx />
      <div className="round-flip" data-focus="event">
        <div className="round-flip-inner">
          <div className="event-card round-card round-card-plain round-card-fx round-flip-face" aria-hidden={phase !== 'front'}>
            <small className="event-card-kind">航海事件</small>
            <div className="event-card-emblem">
              <img src={cardArtUrl({ kind: 'voyage', id: card.event })} alt="" />
            </div>
            <strong>{plain.title}</strong>
            {plain.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="event-card round-card round-card-boss round-card-fx round-flip-face round-flip-back" aria-hidden={phase === 'front'}>
            <small className="event-card-kind">{KIND_TEXT(card)}</small>
            <Face card={card} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** How many small pieces (bubbles, shards, sparks, coins, dice) a card's show has. */
const PIECES = 15;

/**
 * Which show a card comes up with (roundCard.css), one of its own for each big moment so they are told apart at a
 * glance: 暗潮將至 is water (ripples, bubbles rising), the first dark side is lightning (a flash, spikes, shards),
 * 最後的大市集 fireworks, 黑市大開 doors of light opening and gold raining, 最後一搏 a wheel spun and dice thrown.
 * An ordinary voyage event, a later dark side and the plain last round (the round cap) have none.
 */
type Fx = 'tide' | 'flip' | 'bazaar' | 'market' | 'gamble';
const FINAL_FX: Readonly<Record<FinalRoundEffect, Fx>> = { 'final-market': 'bazaar', 'open-market': 'market', 'last-gamble': 'gamble' };
const fxOf = (card: RoundCard): Fx | null => (card.kind === 'rising' ? 'tide' : card.kind === 'final' ? (card.effect === null ? null : FINAL_FX[card.effect]) : card.flipFrom ? 'flip' : null);

/** A fixed scatter in 0…1 for piece `i` (`salt` picks which trait): the same every time, but with no pattern the eye can follow. */
const scatter = (i: number, salt: number): number => {
  const v = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * The pieces of a card's show, behind the card; each carries its angle, its place across the width (−1…1), its delay
 * and its reach. The `--b*` traits are a bubble's own (暗潮將至): its column, size, how long it takes to rise, when it
 * starts and how far it wanders, all scattered so no two rise alike.
 */
function CardFx() {
  return (
    <span className="round-fx" aria-hidden="true">
      {Array.from({ length: PIECES }, (_, i) => {
        const angle = (360 / PIECES) * i + (i % 2) * 9;
        const across = Math.round(Math.sin((angle * Math.PI) / 180) * 100) / 100;
        const bubble = {
          '--bx': `${Math.round((scatter(i, 1) * 2 - 1) * 400)}px`,
          '--bs': `${Math.round(5 + scatter(i, 2) ** 2 * 22)}px`,
          '--bt': `${Math.round(2600 + scatter(i, 3) * 3400)}ms`,
          '--bd': `${Math.round(scatter(i, 4) * 4200)}ms`,
          '--bw': `${Math.round((scatter(i, 5) * 2 - 1) * 46)}px`,
        };
        return <i key={i} style={{ '--a': `${angle}deg`, '--x': across, '--d': `${(i % 5) * 70}ms`, '--r': `${220 + (i % 3) * 70}px`, ...bubble } as CSSProperties} />;
      })}
    </span>
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
    const fx = fxOf(card);
    const showy = fx !== null;
    return (
      <div
        key={at}
        className={`event-card-veil round-veil-${card.kind} round-veil-held ${held === 'leave' ? 'event-leave' : 'event-hold'} ${held === 'ready' ? 'ready' : ''}`}
        {...(fx ? { 'data-fx': fx } : {})}
        role="dialog"
        aria-label={`${KIND_TEXT(card)}：${card.title}`}
        onClick={() => held === 'ready' && setHeld('leave')}
      >
        {showy && <CardFx />}
        <div className={`event-card round-card round-card-${card.kind} ${showy ? 'round-card-fx' : ''}`} data-focus="event">
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
