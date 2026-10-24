import { useLayoutEffect, useState } from 'react';
import { GoodIcon } from '../table3d/GoodIcon';
import { ArrowIcon } from '../table3d/icons';
import { GOODS, type PlayerId } from '../../v07/game';
import { CASH_REASON_LABELS, ISLAND_LABELS, ROLE_LABELS, VOYAGE_EVENT_LABELS } from '../labels';
import type { BeatView } from './beatTimeline';
import type { BeatStep, ShipBeat } from './shipBeat';
import { useBeatPlayback, type BeatPlayback } from './useBeatPlayback';
import './beat.css';

// Focus-layer prototype (docs/ui/v07-layout-research.md §6): one ship's resolution, one thing at a
// time, as a full-screen card over the dimmed table. On the 3D table the same beat is told by
// BeatTag, pinned above the ship.

/** §9.1 step 8: 1–3 sinks, 4–6 arrives. Display only; the outcome itself comes from the event. */
export const SINK_MAX = 3;

type Names = Readonly<Record<PlayerId, string>>;

export const signed = (n: number): string => (n > 0 ? `+${n}` : `−${-n}`);

export function stepTitle(step: BeatStep, names: Names): { readonly name: string; readonly who: string } {
  const who = step.actors.map((id) => names[id] ?? id).join('、');
  switch (step.kind) {
    case 'guard':
      return { name: ROLE_LABELS.guard, who };
    case 'pirate':
      return { name: ROLE_LABELS.pirate, who };
    case 'event':
      return { name: step.source ? (VOYAGE_EVENT_LABELS[step.source as keyof typeof VOYAGE_EVENT_LABELS] ?? '航海事件') : '航海事件', who: '航海事件' };
    case 'island':
      return { name: step.source ? (ISLAND_LABELS[step.source as keyof typeof ISLAND_LABELS] ?? '島嶼') : '島嶼', who: '島嶼特色' };
    case 'clamp':
      return { name: '骰值上下限', who: '最低 1、最高 6' };
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
function useTumble(value: number | null, rolls: boolean): number | null {
  const [face, setFace] = useState<number | null>(null);
  // Before paint, so the real value never flashes ahead of the tumble.
  useLayoutEffect(() => {
    if (!rolls || value === null) return undefined;
    let shown = value;
    const next = () => {
      shown = ((shown + Math.floor(Math.random() * 5)) % 6) + 1;
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
  }, [value, rolls]);
  return face;
}

export function BeatDie({ value, step, stepsShown }: { readonly value: number | null; readonly step: BeatStep | null; readonly stepsShown: number }) {
  const tumbling = useTumble(value, stepsShown === 0);
  const face = tumbling ?? value;
  return (
    <div className="beat-dice">
      {tumbling !== null ? (
        <div className="beat-die tumble">{tumbling}</div>
      ) : (
        <div key={`${value}-${stepsShown}`} className={`beat-die ${step ? (step.delta > 0 ? 'up' : 'down') : ''} shake-${Math.min(3, Math.abs(step?.delta ?? 0))}`}>
          {value ?? '?'}
        </div>
      )}
      <ol className="beat-meter" aria-label="1～3 沉沒，4～6 抵達">
        {[6, 5, 4, 3, 2, 1].map((v) => (
          <li key={v} className={`${v <= SINK_MAX ? 'sink' : 'safe'} ${face === v ? 'on' : ''}`}>
            {v}
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
          {beat.owner === viewer ? '你的船' : `${owner}的船`}
          {beat.rerolled && <em className="beat-chip">情報商人重擲過</em>}
        </strong>
      </header>

      <div className="beat-sea">
        <div key={view.stepsShown} className={`beat-lane ${current ? laneHit(current) : ''}`}>
          <Ship sank={sank} shown={view.showOutcome} />
          {current && <Actor step={current} />}
          {current?.kind === 'pirate' && <span className="beat-flash" />}
        </div>
        <BeatDie value={view.die} step={lastStep} stepsShown={view.stepsShown} />
      </div>

      <div className="beat-caption" aria-live="polite">
        {!view.showStart && <span className="beat-big">出航</span>}
        {view.showStart && !lastStep && !view.showOutcome && <span className="beat-big">起始骰值 {beat.start}</span>}
        {current && (
          <span key={view.stepsShown} className="beat-big">
            {stepTitle(current, names).name} <b className={current.delta > 0 ? 'up' : 'down'}>{signed(current.delta)}</b>
            <small>{stepTitle(current, names).who}</small>
          </span>
        )}
        {view.showOutcome && <span className={`beat-stamp ${sank ? 'down' : 'up'}`}>{sank ? '沉沒' : '抵達'}</span>}
      </div>

      <p className="beat-trail">
        起始 {beat.start}
        {beat.steps.slice(0, view.stepsShown).map((s, i) => (
          <span key={i}>
            <ArrowIcon />
            {stepTitle(s, names).name} {signed(s.delta)}
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
          {beat.armsConfiscated > 0 && (
            <span className="beat-note down">
              <GoodIcon good="arms" size="sm" /> {beat.armsConfiscated} 被沒收
            </span>
          )}
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
            <small>{g.via === 'insurance' ? '航運保險保住' : '打撈公司撈到'}</small>
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
