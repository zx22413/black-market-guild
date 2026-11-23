import { useLayoutEffect, useState } from 'react';
import { GoodIcon } from '../table3d/GoodIcon';
import { ArrowIcon } from '../table3d/icons';
import { GOODS, type PlayerId, type ShipTypeId } from '../../v07/game';
import { CASH_REASON_LABELS, ISLAND_LABELS, ROLE_LABELS, SHIP_TYPE_LABELS, VOYAGE_EVENT_LABELS } from '../labels';
import { FACILITY_LABELS } from '../table/v08Text';
import { gambleText, type Gamble } from './gambleShow';
import { shipMeter } from './shipMeter';
import { dieTop, type BeatView } from './beatTimeline';
import type { BeatStep, ShipBeat } from './shipBeat';
import { useBeatPlayback, type BeatPlayback } from './useBeatPlayback';
import './beat.css';

// Focus-layer prototype (docs/ui/v07-layout-research.md §6): one ship's resolution, one thing at a
// time, as a full-screen card over the dimmed table. On the 3D table the same beat is told by
// BeatTag, pinned above the ship.

type Names = Readonly<Record<PlayerId, string>>;

export const signed = (n: number): string => (n > 0 ? `+${n}` : `−${-n}`);

export function stepTitle(step: BeatStep, names: Names, top = 6): { readonly name: string; readonly who: string } {
  const who = step.actors.map((id) => names[id] ?? id).join('、');
  switch (step.kind) {
    case 'guard':
      // V0.8 prototype: the owner's armory is in this step (the armed ship's bonus counts with the guards'); the events
      // give one number for both, so with guards aboard too the step names both.
      if (step.armory) return step.actors.length === 0 ? { name: FACILITY_LABELS.armory, who: '船上有軍火' } : { name: `${ROLE_LABELS.guard}＋${FACILITY_LABELS.armory}`, who };
      return { name: ROLE_LABELS.guard, who };
    case 'pirate':
      return { name: ROLE_LABELS.pirate, who };
    case 'event':
      return { name: step.source ? (VOYAGE_EVENT_LABELS[step.source as keyof typeof VOYAGE_EVENT_LABELS] ?? '航海事件') : '航海事件', who: '航海事件' };
    case 'island':
      return { name: step.source ? (ISLAND_LABELS[step.source as keyof typeof ISLAND_LABELS] ?? '島嶼') : '島嶼', who: '島嶼特色' };
    case 'clamp':
      return { name: '骰值上下限', who: `最低 1、最高 ${top}` };
  }
}

/** The step on screen, or null before the first one and after the outcome. */
export function currentStep(beat: ShipBeat, view: BeatView): BeatStep | null {
  return view.stepsShown > 0 && !view.showOutcome ? beat.steps[view.stepsShown - 1]! : null;
}

function Ship({ sank, shown }: { readonly sank: boolean; readonly shown: boolean }) {
  return (
    <svg className={`beat-ship ${shown ? (sank ? 'is-sunk' : 'is-arrived') : ''}`} viewBox="0 0 120 90" aria-hidden>
      <path d="M58 8 L58 58" stroke="#5b3a1e" strokeWidth="4" />
      <path d="M62 12 L98 50 L62 50 Z" fill="#f3ead2" stroke="#b9a77d" />
      <path d="M54 16 L24 50 L54 50 Z" fill="#efe3c4" stroke="#b9a77d" />
      <path d="M10 58 L110 58 L96 80 L24 80 Z" fill="#8a5a32" stroke="#4d2f17" strokeWidth="2" />
    </svg>
  );
}

const laneHit = (step: BeatStep): string => (step.kind === 'pirate' ? 'hit-pirate' : step.delta > 0 ? 'hit-up' : 'hit-down');

function Actor({ step }: { readonly step: BeatStep }) {
  const glyph = { guard: '⛨', pirate: '☠', event: '☁', island: '⛰', clamp: '⇕' }[step.kind];
  return <div className={`beat-actor beat-actor-${step.kind}`}>{glyph}</div>;
}

/** The die with the 1–6 meter beside it (1–3 sink, 4–6 arrive). */
/** How long the start die tumbles through its faces before it lands (the dice sound's shake is as long). */
export const DIE_TUMBLE_MS = 520;
const TUMBLE_FACE_MS = 65;

/**
 * The start die's tumble: random faces, never the same twice running, until it lands on `value`.
 * Only when the start value first shows (`rolls`), not when a modifier moves it.
 */
function useTumble(value: number | null, rolls: boolean, top: number): number | null {
  const [face, setFace] = useState<number | null>(null);
  // Before paint, so the real value never flashes ahead of the tumble.
  useLayoutEffect(() => {
    if (!rolls || value === null) return undefined;
    let shown = value;
    const next = () => {
      shown = ((shown + Math.floor(Math.random() * (top - 1))) % top) + 1;
      setFace(shown);
    };
    next();
    const tick = setInterval(next, TUMBLE_FACE_MS);
    const land = setTimeout(() => {
      clearInterval(tick);
      setFace(null);
    }, DIE_TUMBLE_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(land);
      setFace(null);
    };
  }, [value, rolls, top]);
  return face;
}

/** 最後的大市集: how long after the die before it each die lands, so the eye can follow them one by one. */
export const GAMBLE_STAGGER_MS = 320;

/** When the last of `count` thrown dice has landed, from the throw. */
export const gambleLandedMs = (count: number): number => DIE_TUMBLE_MS + (count - 1) * GAMBLE_STAGGER_MS;

/**
 * 最後的大市集: the dice thrown together. They tumble and land one after the other; once `picked` the high one stays,
 * lit, and the others are knocked off the table.
 */
function GambleDice({ gamble, picked, top }: { readonly gamble: Gamble; readonly picked: boolean; readonly top: number }) {
  const count = gamble.dice.length;
  const [landed, setLanded] = useState(picked ? count : 0);
  const [faces, setFaces] = useState<readonly number[]>(gamble.dice);
  // Before paint, so a die's real value never flashes ahead of its tumble.
  useLayoutEffect(() => {
    // Skipped straight to the pick: the dice are down.
    if (picked) {
      setLanded(count);
      return undefined;
    }
    setLanded(0);
    const spin = () => setFaces((now) => now.map((f) => ((f + Math.floor(Math.random() * (top - 1))) % top) + 1));
    spin();
    const tick = setInterval(spin, TUMBLE_FACE_MS);
    const lands = gamble.dice.map((_, i) => setTimeout(() => setLanded((n) => Math.max(n, i + 1)), DIE_TUMBLE_MS + i * GAMBLE_STAGGER_MS));
    const stop = setTimeout(() => clearInterval(tick), gambleLandedMs(count));
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
      lands.forEach(clearTimeout);
    };
  }, [gamble, picked, count, top]);
  return (
    <div className={`gamble-dice ${picked ? 'picked' : ''}`} role="img" aria-label={picked ? `${gambleText(gamble, true).note}，${gambleText(gamble, true).title}` : gambleText(gamble, false).note}>
      {gamble.dice.map((d, i) => {
        const down = i < landed;
        const state = !down ? 'tumble' : !picked ? 'landed' : i === gamble.kept ? 'kept' : 'dropped';
        return (
          <div key={i} className={`beat-die gamble-die ${state}`}>
            {down ? d : faces[i]}
          </div>
        );
      })}
    </div>
  );
}

export interface BeatDieProps {
  readonly value: number | null;
  readonly step: BeatStep | null;
  readonly stepsShown: number;
  readonly type: ShipTypeId;
  readonly top?: number;
  /** 最後的大市集: the dice thrown, while they are the thing on screen (`BeatView.gamble`); the single die otherwise. */
  readonly gamble?: { readonly dice: Gamble; readonly picked: boolean } | null;
}

export function BeatDie({ value, step, stepsShown, type, top = 6, gamble = null }: BeatDieProps) {
  const meter = shipMeter(type);
  const sinkMax = Math.max(0, ...meter.filter((c) => c.sinks).map((c) => c.value));
  const tumbling = useTumble(value, stepsShown === 0 && !gamble, Math.max(top, meter.length));
  // While the dice are still in the air the meter says nothing of where they will land.
  const face = gamble ? (gamble.picked ? gamble.dice.value : null) : (tumbling ?? value);
  return (
    <div className="beat-dice">
      {gamble ? (
        <GambleDice gamble={gamble.dice} picked={gamble.picked} top={Math.max(top, meter.length)} />
      ) : tumbling !== null ? (
        <div className="beat-die tumble">{tumbling}</div>
      ) : (
        <div key={`${value}-${stepsShown}`} className={`beat-die ${step ? (step.delta > 0 ? 'up' : 'down') : ''} shake-${Math.min(3, Math.abs(step?.delta ?? 0))}`}>
          {value ?? '?'}
        </div>
      )}
      <ol className="beat-meter" aria-label={sinkMax === 0 ? `${SHIP_TYPE_LABELS[type]}不會沉` : `${SHIP_TYPE_LABELS[type]}：1～${sinkMax} 沉沒，${sinkMax + 1} 以上抵達`}>
        {meter.map((cell) => (
          <li key={cell.value} className={`${cell.sinks ? 'sink' : 'safe'} ${face === cell.value ? 'on' : ''}`}>
            {cell.value}
          </li>
        ))}
      </ol>
    </div>
  );
}

export interface BeatCardProps {
  readonly beat: ShipBeat;
  readonly playback: BeatPlayback;
  readonly names: Names;
  readonly viewer: PlayerId | null;
  readonly onDone?: () => void;
}

export function BeatCard({ beat, playback, names, viewer, onDone }: BeatCardProps) {
  const { view, jump, next, total } = playback;
  const current = currentStep(beat, view);
  const lastStep = view.stepsShown > 0 ? beat.steps[view.stepsShown - 1]! : null;
  const sank = beat.outcome === 'sank';
  const gamble = beat.gamble && view.gamble ? { dice: beat.gamble, picked: view.gamble === 'picked' } : null;
  const owner = names[beat.owner] ?? beat.owner;
  const cargo = GOODS.flatMap((g) => Array.from({ length: beat.cargo[g] }, () => g));
  const advance = () => {
    if (!next()) onDone?.();
  };
  const stop = (action: () => void) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    action();
  };

  return (
    <div className="beat-card">
      <header className="beat-head">
        <span>第 {beat.round} 回合 · 航程結算</span>
        <strong>
          {beat.owner === viewer ? '你' : owner}的{SHIP_TYPE_LABELS[beat.type]}
        </strong>
      </header>

      <div className="beat-sea">
        <div key={view.stepsShown} className={`beat-lane ${current ? laneHit(current) : ''}`}>
          <Ship sank={sank} shown={view.showOutcome} />
          {current && <Actor step={current} />}
          {current?.kind === 'pirate' && <span className="beat-flash" />}
        </div>
        <BeatDie value={view.die} step={lastStep} stepsShown={view.stepsShown} type={beat.type} top={dieTop(beat)} gamble={gamble} />
      </div>

      <div className="beat-caption" aria-live="polite">
        {!view.showStart && <span className="beat-big">出航</span>}
        {gamble && (
          <span key={view.gamble} className="beat-big">
            {gambleText(gamble.dice, gamble.picked).title}
            <small>{gambleText(gamble.dice, gamble.picked).note}</small>
          </span>
        )}
        {view.showStart && !gamble && !lastStep && !view.showOutcome && <span className="beat-big">起始骰值 {view.die ?? beat.start}</span>}
        {current && (
          <span key={view.stepsShown} className="beat-big">
            {stepTitle(current, names, dieTop(beat)).name} <b className={current.delta > 0 ? 'up' : 'down'}>{signed(current.delta)}</b>
            <small>{stepTitle(current, names, dieTop(beat)).who}</small>
          </span>
        )}
        {view.showOutcome && <span className={`beat-stamp ${sank ? 'down' : 'up'}`}>{sank ? '沉沒' : '抵達'}</span>}
      </div>

      <p className="beat-trail">
        起始 {view.gamble === 'thrown' ? '？' : view.gamble === 'picked' ? view.die : beat.start}
        {beat.steps.slice(0, view.stepsShown).map((s, i) => (
          <span key={i}>
            <ArrowIcon />
            {stepTitle(s, names, dieTop(beat)).name} {signed(s.delta)}
          </span>
        ))}
        {view.showOutcome && (
          <>
            {' ＝ '}
            <b>{beat.final}</b>
          </>
        )}
      </p>

      {view.showCargo && (
        <div className="beat-cargo">
          <span className="beat-label">船上的貨</span>
          {cargo.map((g, i) => (
            <span key={i} className={`beat-crate good-${g}`} style={{ animationDelay: `${i * 90}ms` }}>
              <GoodIcon good={g} />
            </span>
          ))}
          {beat.confiscated.map((c) => (
            <span key={c.good} className="beat-note down">
              <GoodIcon good={c.good} size="sm" /> {c.units} 被沒收
            </span>
          ))}
        </div>
      )}

      <ul className="beat-cash">
        {beat.cash.slice(0, view.cashShown).map((c, i) => (
          <li key={i} className={c.playerId === viewer ? 'mine' : ''}>
            <b className={c.amount >= 0 ? 'up' : 'down'}>
              {c.amount >= 0 ? '+' : '−'}
              {Math.abs(c.amount)} G
            </b>
            <span>{c.playerId === viewer ? '你' : (names[c.playerId] ?? c.playerId)}</span>
            <small>{CASH_REASON_LABELS[c.reason]}</small>
          </li>
        ))}
        {beat.goods.slice(0, view.goodsShown).map((g, i) => (
          <li key={`g${i}`} className={g.playerId === viewer ? 'mine' : ''}>
            <b className="up">
              +{g.units} <GoodIcon good={g.good} size="sm" />
            </b>
            <span>{g.playerId === viewer ? '你' : (names[g.playerId] ?? g.playerId)}</span>
            <small>打撈公司撈到</small>
          </li>
        ))}
      </ul>

      <footer className="beat-foot">
        <button type="button" onClick={stop(() => jump(0))}>
          再看一次
        </button>
        <button type="button" onClick={stop(() => jump(total))}>
          跳到結果
        </button>
        <button type="button" className="primary" onClick={stop(() => (view.done ? onDone?.() : advance()))}>
          {view.done ? '繼續' : '下一步'}
        </button>
      </footer>
    </div>
  );
}

export interface ShipBeatStageProps {
  readonly beat: ShipBeat;
  readonly names: Names;
  readonly viewer: PlayerId | null;
  readonly onDone?: () => void;
}

/** The beat as a full-screen card over the dimmed table; a click anywhere jumps to the next cue. */
export function ShipBeatStage({ beat, names, viewer, onDone }: ShipBeatStageProps) {
  const playback = useBeatPlayback(beat);
  const owner = names[beat.owner] ?? beat.owner;
  return (
    <div className="beat-backdrop" onClick={() => (playback.next() ? undefined : onDone?.())} role="dialog" aria-label={`${owner}的船：結算`}>
      <BeatCard beat={beat} playback={playback} names={names} viewer={viewer} {...(onDone ? { onDone } : {})} />
    </div>
  );
}
