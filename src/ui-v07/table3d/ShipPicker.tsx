import { useState } from 'react';
import type { ShipTypeId } from '../../v07/game';
import { SHIP_TYPE_LABELS, SHIP_TYPE_TEXT } from '../labels';
import type { ShipCard } from '../table/shipChoice';
import { ClockIcon, ForbidIcon, IconDisc, tokenIconUrl } from './icons';
import './shipPicker.css';

// The ship hand of the ship-bay experiment (docs/proposals/2026-11-ship-bays.md): one card per ship type with
// its fee, rest time and sinking chance, and above them the strip with the dice table of the card pointed at
// or picked. It is the role hand's layout (useDeployStep): the card carries what you compare, the strip what
// you read once.

/** The ship card picked: a ship type, "不出航" ('none'), or nothing yet (null). */
export type ShipPick = ShipTypeId | 'none' | null;

interface ShipPickerProps {
  readonly cards: readonly ShipCard[];
  readonly picked: ShipPick;
  /** Gold breathing on the hand until a card is picked. */
  readonly todo: boolean;
  /** Modifier of the voyage event and island, already in the dice table (0 = none). */
  readonly modifier: number;
  readonly onPick: (pick: ShipTypeId | 'none') => void;
}

const signed = (n: number): string => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;

export function ShipPicker({ cards, picked, todo, modifier, onPick }: ShipPickerProps) {
  // The card the pointer is on: the strip describes it (else the picked one). Only a mouse peeks by hovering,
  // as in the role hand: on iOS a hover that adds to the page swallows the first tap.
  const [peek, setPeek] = useState<ShipPick>(null);
  const [stripOpen, setStripOpen] = useState(false);
  const shown = peek ?? picked;
  const card = shown !== null && shown !== 'none' ? cards.find((c) => c.id === shown) : undefined;
  const modifierChip = modifier !== 0 && (
    <span className="chip" title="事件與島嶼的修正已算進骰值表；護衛、海盜等角色的修正出航後才知道。">
      修正 {signed(modifier)}
    </span>
  );

  const strip =
    shown === null ? (
      <div className="dep-strip idle ship-strip">
        <p>選一艘船出航，或選「不出航」。</p>
      </div>
    ) : (
      <div className={`dep-strip ship-strip ${stripOpen ? 'open' : ''}`} aria-live="polite" onClick={() => setStripOpen((v) => !v)}>
        {shown === 'none' && (
          <>
            <header>
              <b>不出航</b>
            </header>
            <p>這回合船留在港裡，不付船費。</p>
          </>
        )}
        {card && (
          <>
            <header>
              <b>{SHIP_TYPE_LABELS[card.id]}</b>
              <span className="chip" title={`船費 ${card.fee} G`}>
                <IconDisc src={tokenIconUrl('coin')} />
                {card.fee}
              </span>
              <span className="chip" title={card.cooldown === 0 ? '沒有冷卻' : `用過後冷卻 ${card.cooldown} 回合`}>
                <ClockIcon />
                {card.cooldown}
              </span>
              {modifierChip}
              {SHIP_TYPE_TEXT[card.id] && <span className="ship-ability">{SHIP_TYPE_TEXT[card.id]}</span>}
            </header>
            <ol className="ship-dice" aria-label="骰值表：擲出的點數，與這艘船拿到貨值的幾成">
              <li className="label" aria-hidden="true">
                <small>擲出</small>
                <b>拿貨值</b>
              </li>
              {card.rows.map((row) => (
                <li key={row.roll} className={row.sinks ? 'sink' : row.percent > 100 ? 'win' : ''} title={row.sinks ? `擲 ${row.roll}（最終值 ${row.final}）：沉，貨全損` : `擲 ${row.roll}（最終值 ${row.final}）：拿到貨值的 ${row.percent}%`}>
                  <small>{row.roll}</small>
                  <b>{row.sinks ? '沉' : `${row.percent}%`}</b>
                </li>
              ))}
            </ol>
            {card.reason && <p className="why">{card.reason}</p>}
          </>
        )}
      </div>
    );

  const hand = (
    <div className={`dep-hand ship-hand ${todo ? 'todo' : ''} ${picked !== null ? 'picked' : ''}`} onPointerLeave={(e) => e.pointerType === 'mouse' && setPeek(null)}>
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`dep-card ship-card ${picked === c.id ? 'on' : ''} ${c.legal ? '' : 'off'}`}
          data-ship-card={c.id}
          data-done={picked === c.id}
          onPointerEnter={(e) => e.pointerType === 'mouse' && setPeek(c.id)}
          onFocus={() => setPeek(c.id)}
          onBlur={() => setPeek(null)}
          aria-disabled={!c.legal}
          // A greyed card says why on a tap too (touch browsers do not always focus a tapped button).
          onClick={() => (c.legal ? onPick(c.id) : setPeek(c.id))}
        >
          {!c.legal && (
            <span className="dep-card-off" aria-hidden="true">
              <ForbidIcon />
            </span>
          )}
          <span className="dep-ic">
            <img src={tokenIconUrl('ship')} alt="" />
          </span>
          <b>{SHIP_TYPE_LABELS[c.id]}</b>
          <span className="dep-fee" title={`船費 ${c.fee} G`}>
            <IconDisc src={tokenIconUrl('coin')} />
            {c.fee}
          </span>
          <span className="ship-odds" title={`沉船機率 ${c.sinkPercent}%${c.cooldown > 0 ? `；用過後冷卻 ${c.cooldown} 回合` : ''}`}>
            <span>沉 {c.sinkPercent}%</span>
            {c.cooldown > 0 && (
              <span className="ship-rest">
                <ClockIcon />
                {c.cooldown}
              </span>
            )}
          </span>
        </button>
      ))}
      <button
        type="button"
        className={`dep-card ship-card none ${picked === 'none' ? 'on' : ''}`}
        data-ship-card="none"
        data-done={picked === 'none'}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setPeek('none')}
        onFocus={() => setPeek('none')}
        onBlur={() => setPeek(null)}
        onClick={() => onPick('none')}
      >
        <span className="dep-ic none">✕</span>
        <b>不出航</b>
        <span className="dep-fee">&nbsp;</span>
        <span className="ship-odds">&nbsp;</span>
      </button>
    </div>
  );

  return (
    <>
      {strip}
      {hand}
    </>
  );
}
