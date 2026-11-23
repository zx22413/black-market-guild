import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ShipTypeId } from '../../v07/game';
import { SHIP_TYPE_LABELS, SHIP_TYPE_TEXT } from '../labels';
import { GOODS } from '../../v07/game';
import type { ShipSkill } from '../table/investChoice';
import type { ShipCard, ShipEffect } from '../table/shipChoice';
import { SKILL_LABELS, skillText } from '../table/v08Text';
import { GoodCount } from './GoodIcon';
import { useRules } from './rulesContext';
import { ClockIcon, ForbidIcon, IconDisc, tokenIconUrl } from './icons';
import { InfoTip } from './InfoTip';
import { arrivalProps, type StepArrival } from './StepArrival';
import './shipPicker.css';

// The ship pick of the ship-bay experiment (docs/proposals/2026-11-ship-bays.md): a hand with one card per ship
// type (fee, rest time, sinking chance) in the role hand's layout (useDeployStep), and the card that tells the
// rest of the card pointed at or picked: its curve and ability. On a wide screen that card stands beside the
// ship, so the ship keeps the height; on a phone it is the strip above the hand, as for the roles.
//
// The curve and the sinking chance are the ship's own data. What the public modifiers (the voyage event, the
// island) do to it is shown once: when a ship is first picked in a round (hovering does not count), the
// modifier flies into the table, a column says which rolls land on each final value, and the card's sinking
// chance goes from its own value to the one with the modifier. Picked again, it just shows the result.

/** The ship card picked: a ship type, "不出航" ('none'), or nothing yet (null). */
export type ShipPick = ShipTypeId | 'none' | null;

const NO_ARRIVAL: StepArrival = { waiting: false, playing: false };

/** The ship's own illustration on its card, in the card art's flat style (public/art/cards, SOURCES.md). */
const shipArtUrl = (type: ShipTypeId): string => `${import.meta.env.BASE_URL}art/cards/ship-${type}.svg`;

const signed = (n: number): string => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;
/** What the dice table's two row titles say when they are hovered or tapped (numbers come from the table itself). */
const FINAL_VALUE_TEXT = '出航時擲一顆骰子，再加上航海事件、島嶼與護衛（+1）、海盜（−1）的修正，就是這艘船的最終值（最低 1）。最終值決定船沉不沉，以及拿到多少貨值。';
const CARGO_SHARE_TEXT = '船抵達時，船東拿到船上貨物價值的幾成：100% 是原價，超過 100% 是加成；「沉」代表貨物全損。貨值以抵達那回合的價格計。';

// V0.8 prototype (rules.v08.crates, not rules): the table gives crates lost instead of a share of the cargo's value.
const CRATE_LOSS_TEXT = '船抵達時掉進海裡的貨箱數，從最貴的開始掉；剩下的箱子照抵達那回合的價格賣。「×」是到港貨箱的加成倍率；「沉」代表貨物全損。';
const times = (percent: number): string => `×${percent / 100}`;
/** What a row of the crate table pays: 「沉」, 「全到」, 「掉 2」, with the multiplier when it is not 1. */
export function crateRowText(row: { readonly sinks: boolean; readonly lose: number | null; readonly percent: number }): string {
  if (row.sinks) return '沉';
  const bonus = row.percent === 100 ? '' : times(row.percent);
  if (row.lose === 0) return bonus || '全到';
  return `掉 ${row.lose}${bonus ? ` ${bonus}` : ''}`;
}

const partsText = (effect: ShipEffect): string => effect.parts.map((p) => `${p.label} ${signed(p.delta)}`).join('、');
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How long the modifier's flight takes (ms); the table changes after it. */
export const FLIGHT_MS = 750;
const COUNT_STEPS = 10;
const COUNT_STEP_MS = 50;

/** "17→0%": the chance counts from the ship's own value to the one with the modifier when `play`, else it just shows both. */
function SinkChange({ from, to, play }: { readonly from: number; readonly to: number; readonly play: boolean }) {
  const [value, setValue] = useState(play && !reducedMotion() ? from : to);
  useEffect(() => {
    if (!play || reducedMotion()) {
      setValue(to);
      return undefined;
    }
    setValue(from);
    const timers = Array.from({ length: COUNT_STEPS }, (_, i) => window.setTimeout(() => setValue(Math.round(from + ((to - from) * (i + 1)) / COUNT_STEPS)), FLIGHT_MS + (i + 1) * COUNT_STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [play, from, to]);
  return <>{from === to ? `${to}%` : `${from}→${value}%`}</>;
}

interface ShipHandProps {
  readonly cards: readonly ShipCard[];
  readonly picked: ShipPick;
  /** Gold breathing on the hand until a card is picked. */
  readonly todo: boolean;
  readonly effect: ShipEffect;
  /** Ships picked at least once this round: their card shows what the modifier does to the sinking chance. */
  readonly revealed: ReadonlySet<ShipTypeId>;
  /** The ship whose effect is playing right now. */
  readonly fresh: ShipTypeId | null;
  readonly onPick: (pick: ShipTypeId | 'none') => void;
  /** The card the pointer is on (null when it leaves): the info card describes it. Only a mouse peeks by hovering, as in the role hand. */
  readonly onPeek: (pick: ShipPick) => void;
  /** The step's arrival (StepArrival): hidden while the camera dives in, dealt one card after another once it lands. */
  readonly arrival?: StepArrival;
  /** V0.8 prototype: each ship's skill (a mark on the cards whose skill is open or being opened); absent without skills. */
  readonly skills?: ShipSkills;
}

/** V0.8 prototype (rules.v08, not rules): the skill of each ship type, as the invest step works it out. */
export type ShipSkills = Partial<Record<ShipTypeId, ShipSkill>>;
const SKILL_STATE: Readonly<Record<ShipSkill['state'], string>> = { open: '已開啟', opening: '本回合開啟', closed: '未開啟' };

export function ShipHand({ cards, picked, todo, effect, revealed, fresh, onPick, onPeek, arrival = NO_ARRIVAL, skills = {} }: ShipHandProps) {
  const arrive = arrivalProps(arrival);
  return (
    <div className={`dep-hand ship-hand ${todo ? 'todo' : ''} ${picked !== null ? 'picked' : ''} ${arrive.className}`} {...(arrive.style ? { style: arrive.style } : {})} onPointerLeave={(e) => e.pointerType === 'mouse' && onPeek(null)}>
      {cards.map((c) => {
        const withEffect = effect.total !== 0 && revealed.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={`dep-card ship-card ${picked === c.id ? 'on' : ''} ${c.legal ? '' : 'off'}`}
            data-ship-card={c.id}
            data-done={picked === c.id}
            onPointerEnter={(e) => e.pointerType === 'mouse' && onPeek(c.id)}
            onFocus={() => onPeek(c.id)}
            onBlur={() => onPeek(null)}
            aria-disabled={!c.legal}
            // A greyed card says why on a tap too (touch browsers do not always focus a tapped button).
            onClick={() => (c.legal ? onPick(c.id) : onPeek(c.id))}
          >
            {!c.legal && (
              <span className="dep-card-off" aria-hidden="true">
                <ForbidIcon />
              </span>
            )}
            <span className="dep-ic ship-art">
              <img src={shipArtUrl(c.id)} alt="" />
            </span>
            {skills[c.id] && skills[c.id]!.state !== 'closed' && (
              <span className={`ship-skill-mark ${skills[c.id]!.state}`} title={`${SKILL_LABELS[c.id]}：${SKILL_STATE[skills[c.id]!.state]}`}>
                {SKILL_LABELS[c.id]}
              </span>
            )}
            <b>{SHIP_TYPE_LABELS[c.id]}</b>
            <span className="dep-fee" title={`船費 ${c.fee} G`}>
              <IconDisc src={tokenIconUrl('coin')} />
              {c.fee}
            </span>
            <span
              className="ship-odds"
              title={`沉船機率 ${c.sinkPercent}%（骰子六面中最終值會沉的比例）${withEffect ? `；加上${partsText(effect)}是 ${c.sinkPercentNow}%` : ''}${c.cooldown > 0 ? `；用過後冷卻 ${c.cooldown} 回合` : ''}`}
            >
              <span className={withEffect && c.sinkPercent !== c.sinkPercentNow ? 'changed' : ''}>
                沉 {withEffect ? <SinkChange from={c.sinkPercent} to={c.sinkPercentNow} play={fresh === c.id} /> : `${c.sinkPercent}%`}
              </span>
              {c.cooldown > 0 && (
                <span className="ship-rest">
                  <ClockIcon />
                  {c.cooldown}
                </span>
              )}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        className={`dep-card ship-card none ${picked === 'none' ? 'on' : ''}`}
        data-ship-card="none"
        data-done={picked === 'none'}
        onPointerEnter={(e) => e.pointerType === 'mouse' && onPeek('none')}
        onFocus={() => onPeek('none')}
        onBlur={() => onPeek(null)}
        onClick={() => onPick('none')}
      >
        <span className="dep-ic none">✕</span>
        <b>不出航</b>
        <span className="dep-fee">&nbsp;</span>
        <span className="ship-odds">&nbsp;</span>
      </button>
    </div>
  );
}

interface ShipInfoProps {
  readonly cards: readonly ShipCard[];
  /** The card described: the one pointed at, else the one picked. */
  readonly shown: ShipPick;
  readonly effect: ShipEffect;
  readonly revealed: ReadonlySet<ShipTypeId>;
  readonly fresh: ShipTypeId | null;
  /** 'side': the card beside the ship; 'strip': the strip above the hand, folded to its header until tapped. */
  readonly layout: 'side' | 'strip';
  /** The step's arrival (StepArrival): the card comes in with the hand. */
  readonly arrival?: StepArrival;
  /** V0.8 prototype: each ship's skill, and the switch that opens the shown ship's (or takes the opening back). */
  readonly skills?: ShipSkills;
  readonly onSkill?: (ship: ShipTypeId) => void;
}

export function ShipInfo({ cards, shown, effect, revealed, fresh, layout, arrival = NO_ARRIVAL, skills = {}, onSkill }: ShipInfoProps) {
  const rules = useRules();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const token = useRef<HTMLSpanElement>(null);
  const card = shown !== null && shown !== 'none' ? cards.find((c) => c.id === shown) : undefined;
  const side = layout === 'side';
  const rolled = card !== undefined && effect.total !== 0 && revealed.has(card.id);
  const crates = card !== undefined && card.curve.some((r) => r.lose !== null);
  const play = card !== undefined && fresh === card.id;
  const frame = `${side ? 'dep-strip ship-strip ship-info' : `dep-strip ship-strip ${open ? 'open' : ''}`} ${arrivalProps(arrival).className}`;
  const arriveStyle = arrivalProps(arrival).style;
  const arrive = arriveStyle ? { style: arriveStyle } : {};

  // A strip folded to its header would play its show unseen: it opens for it.
  useEffect(() => {
    if (play && !side) setOpen(true);
  }, [play, side]);

  // The modifier leaves the event chip (top left) and flies into the card; then the table changes (CSS, `fresh`).
  useLayoutEffect(() => {
    const el = token.current;
    const box = root.current;
    if (!play || !el || !box || reducedMotion()) return undefined;
    const from = (document.querySelector('.event-chip') ?? box).getBoundingClientRect();
    const to = box.getBoundingClientRect();
    const flight = el.animate(
      [
        { transform: `translate(${from.left + 8}px, ${from.top + 6}px) scale(1)`, opacity: 1 },
        { transform: `translate(${to.left + 24}px, ${to.top + 14}px) scale(0.9)`, opacity: 1, offset: 0.85 },
        { transform: `translate(${to.left + 24}px, ${to.top + 14}px) scale(0.9)`, opacity: 0 },
      ],
      { duration: FLIGHT_MS, easing: 'ease-in-out', fill: 'both' },
    );
    return () => flight.cancel();
  }, [play]);

  if (shown === null) {
    return (
      <div className={`${frame} idle`} {...arrive}>
        <p>選一艘船出航，或選「不出航」。</p>
      </div>
    );
  }
  return (
    <div ref={root} className={frame} {...arrive} aria-live="polite" {...(side ? {} : { onClick: () => setOpen((v) => !v) })}>
      {play &&
        // In the body: the phone's dock is moved by a transform, which would carry a fixed child with it.
        createPortal(
          <span ref={token} className="ship-token" aria-hidden="true" style={{ opacity: 0 }}>
            {partsText(effect)}
          </span>,
          document.body,
        )}
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
            {!side && SHIP_TYPE_TEXT[card.id] && <span className="ship-ability">{SHIP_TYPE_TEXT[card.id]}</span>}
          </header>
          {side && SHIP_TYPE_TEXT[card.id] && <p className="ship-ability-line">{SHIP_TYPE_TEXT[card.id]}</p>}
          <ol
            className={`ship-dice ${card.curve.length > 6 ? 'long' : ''} ${rolled ? 'rolled' : ''} ${play ? 'fresh' : ''}`}
            style={{ '--faces': card.curve.length } as CSSProperties}
            aria-label={crates ? '骰值表：最終值，與這艘船掉的貨箱數' : '骰值表：最終值，與這艘船的獲利率'}
          >
            <li className="label">
              {rolled && (
                <InfoTip title="擲出" text="這回合的修正（航海事件、島嶼、護衛與海盜）都算進去後，擲到這些點數的船，會落在這一欄的最終值。">
                  <em>擲出</em>
                </InfoTip>
              )}
              <InfoTip title="最終值" text={FINAL_VALUE_TEXT}>
                <small>最終值</small>
              </InfoTip>
              <InfoTip title={crates ? '掉貨' : '獲利率'} text={crates ? CRATE_LOSS_TEXT : CARGO_SHARE_TEXT}>
                <b>{crates ? '掉貨' : '獲利率'}</b>
              </InfoTip>
            </li>
            {card.curve.map((row, i) => {
              const rolls = card.effectRolls[i] ?? [];
              return (
                <li
                  key={row.final}
                  className={`${row.sinks ? 'sink' : row.percent > 100 ? 'win' : ''} ${rolled && rolls.length === 0 ? 'dead' : ''}`}
                  style={{ '--i': i } as CSSProperties}
                  title={row.sinks ? `最終值 ${row.final}：沉，貨全損` : row.lose !== null ? `最終值 ${row.final}${row.orMore ? ' 以上' : ''}：${row.lose === 0 ? '貨全到' : `掉 ${row.lose} 箱`}${row.percent === 100 ? '' : `，到港的貨 ${times(row.percent)}`}` : `最終值 ${row.final}${row.orMore ? ' 以上' : ''}：獲利率 ${row.percent}%（拿到貨值的 ${row.percent}%）`}
                >
                  {rolled && <em>{rolls.length > 0 ? rolls.join('、') : '—'}</em>}
                  <small>{row.orMore ? `${row.final}+` : row.final}</small>
                  <b>{row.lose !== null ? crateRowText(row) : row.sinks ? '沉' : `${row.percent}%`}</b>
                </li>
              );
            })}
          </ol>
          {rolled && <p className={`ship-effect-note ${play ? 'fresh' : ''}`}>{partsText(effect)}</p>}
          {effect.limit && <p className="ship-effect-note">{effect.limit}</p>}
          {effect.conditional && <p className="ship-effect-note">{effect.conditional}</p>}
          {card.reason && <p className="why">{card.reason}</p>}
          {skills[card.id] && <SkillRow ship={card.id} skill={skills[card.id]!} text={skillText(rules, card.id)} {...(onSkill ? { onToggle: () => onSkill(card.id) } : {})} />}
        </>
      )}
    </div>
  );
}

/** The raised gambler's table while loading (V0.8 prototype): each final value, red where the raised ship sinks. */
export function RaiseDice({ curve }: { readonly curve: readonly { readonly final: number; readonly sinks: boolean; readonly lose: number | null; readonly percent: number; readonly orMore: boolean }[] }) {
  if (curve.length === 0) return null;
  return (
    <ol className="raise-dice" aria-label="加注後的骰值表：最終值，與到港或沉船">
      {curve.map((row) => (
        <li key={row.final} className={row.sinks ? 'sink' : 'win'} title={row.sinks ? `最終值 ${row.final}：加注後沉船，貨全損` : `最終值 ${row.final}${row.orMore ? ' 以上' : ''}：${crateRowText(row)}`}>
          <small>{row.orMore ? `${row.final}+` : row.final}</small>
          <b>{row.sinks ? '沉' : times(row.percent)}</b>
        </li>
      ))}
    </ol>
  );
}

interface SkillRowProps {
  readonly ship: ShipTypeId;
  readonly skill: ShipSkill;
  readonly text: string;
  readonly onToggle?: () => void;
}

/** V0.8 prototype: the ship's skill on its info card: what it does, whether it is open, and the button that opens it for its crates. */
function SkillRow({ ship, skill, text, onToggle }: SkillRowProps) {
  const opening = skill.state === 'opening';
  // Closed and the crates are there: the slot is lit and says so.
  const can = skill.state === 'closed' && skill.legal && onToggle !== undefined;
  return (
    <section className={`ship-skill ${skill.state} ${can ? 'can' : ''}`} data-focus={`skill-${ship}`} data-done={skill.state !== 'closed'} onClick={(e) => e.stopPropagation()}>
      <header>
        <small>技能</small>
        <b>{SKILL_LABELS[ship]}</b>
        <span className="ship-skill-state">{can ? '可開啟' : SKILL_STATE[skill.state]}</span>
      </header>
      <p>{text}</p>
      {skill.state !== 'open' && onToggle && (
        <button type="button" className="ship-skill-open" disabled={!skill.legal && !opening} aria-pressed={opening} onClick={onToggle}>
          {opening ? '取消開啟' : '開啟'}
          {!opening &&
            GOODS.filter((g) => skill.cost[g] > 0).map((g) => (
              <GoodCount key={g} good={g} count={skill.cost[g]} size="sm" />
            ))}
        </button>
      )}
      {skill.state === 'closed' && !skill.legal && skill.reason && <small className="ship-skill-why">{skill.reason}</small>}
    </section>
  );
}
