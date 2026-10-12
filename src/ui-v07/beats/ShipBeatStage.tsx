import { useEffect, useMemo, useRef, useState } from 'react';
import { GOODS, type PlayerId } from '../../v07/game';
import { CASH_REASON_LABELS, GOOD_LABELS, ISLAND_LABELS, ROLE_LABELS, VOYAGE_EVENT_LABELS } from '../labels';
import { beatCues, cuesStarted } from './beatTimeline';
import type { BeatStep, ShipBeat } from './shipBeat';
import './beat.css';

// Focus-layer prototype: one ship's resolution as a full-screen card over a dimmed table
// (docs/ui/v07-layout-research.md §6). Plays by itself; a click anywhere jumps to the next cue.

/** §9.1 step 8: 1–3 sinks, 4–6 arrives. Display only; the outcome itself comes from the event. */
const SINK_MAX = 3;

export interface ShipBeatStageProps {
  readonly beat: ShipBeat;
  readonly names: Readonly<Record<PlayerId, string>>;
  readonly viewer: PlayerId | null;
  readonly onDone?: () => void;
}

const signed = (n: number): string => (n > 0 ? `+${n}` : `−${-n}`);

function stepTitle(step: BeatStep, names: Readonly<Record<PlayerId, string>>): { readonly name: string; readonly who: string } {
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

/** Playback clock in ms; `jump` moves it (and restarts the frame loop if it had stopped). */
function useBeatClock(total: number, key: string): readonly [number, (ms: number) => void] {
  const [elapsed, setElapsed] = useState(0);
  const origin = useRef(0);
  const frame = useRef(0);
  const run = useRef<() => void>(() => {});
  run.current = () => {
    cancelAnimationFrame(frame.current);
    const tick = (now: number) => {
      const t = now - origin.current;
      setElapsed(t);
      if (t <= total) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  useEffect(() => {
    origin.current = performance.now();
    setElapsed(0);
    run.current();
    return () => cancelAnimationFrame(frame.current);
  }, [total, key]);
  const jump = (ms: number) => {
    origin.current = performance.now() - ms;
    setElapsed(ms);
    run.current();
  };
  return [elapsed, jump] as const;
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

export function ShipBeatStage({ beat, names, viewer, onDone }: ShipBeatStageProps) {
  const cues = useMemo(() => beatCues(beat), [beat]);
  const total = cues[cues.length - 1]!.at;
  const [elapsed, jump] = useBeatClock(total, beat.shipId);
  const started = cuesStarted(cues, elapsed);
  const shown = cues.slice(0, started);
  const has = (kind: string) => shown.some((c) => c.kind === kind);
  const stepsShown = shown.filter((c) => c.kind === 'step').length;
  const cashShown = shown.filter((c) => c.kind === 'cash').length;
  const goodsShown = shown.filter((c) => c.kind === 'goods').length;
  const current = stepsShown > 0 ? beat.steps[stepsShown - 1]! : null;
  const die = !has('start') ? null : current ? Math.min(6, Math.max(1, current.value)) : beat.start;
  const done = has('done');
  const sank = beat.outcome === 'sank';

  const next = () => {
    const upcoming = cues[started];
    if (upcoming) jump(upcoming.at);
    else onDone?.();
  };

  const owner = names[beat.owner] ?? beat.owner;
  const cargo = GOODS.flatMap((g) => Array.from({ length: beat.cargo[g] }, () => g));

  return (
    <div className="beat-backdrop" onClick={next} role="dialog" aria-label={`${owner}的船：結算`}>
      <div className="beat-card">
        <header className="beat-head">
          <span>第 {beat.round} 回合 · 航程結算</span>
          <strong>
            {beat.owner === viewer ? '你的船' : `${owner}的船`}
            {beat.rerolled && <em className="beat-chip">情報商人重擲過</em>}
          </strong>
        </header>

        <div className="beat-sea">
          <div key={stepsShown} className={`beat-lane ${current && !has('outcome') ? laneHit(current) : ''}`}>
            <Ship sank={sank} shown={has('outcome')} />
            {current && <Actor step={current} />}
            {current?.kind === 'pirate' && !has('outcome') && <span className="beat-flash" />}
          </div>

          <div className="beat-dice">
            <div key={`${die}-${stepsShown}`} className={`beat-die ${current ? (current.delta > 0 ? 'up' : 'down') : ''} shake-${Math.min(3, Math.abs(current?.delta ?? 0))}`}>
              {die ?? '?'}
            </div>
            <ol className="beat-meter" aria-label="1～3 沉沒，4～6 抵達">
              {[6, 5, 4, 3, 2, 1].map((v) => (
                <li key={v} className={`${v <= SINK_MAX ? 'sink' : 'safe'} ${die === v ? 'on' : ''}`}>
                  {v}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="beat-caption" aria-live="polite">
          {!has('start') && <span className="beat-big">出航</span>}
          {has('start') && !current && <span className="beat-big">起始骰值 {beat.start}</span>}
          {current && !has('outcome') && (
            <span className="beat-big">
              {stepTitle(current, names).name} <b className={current.delta > 0 ? 'up' : 'down'}>{signed(current.delta)}</b>
              <small>{stepTitle(current, names).who}</small>
            </span>
          )}
          {has('outcome') && <span className={`beat-stamp ${sank ? 'down' : 'up'}`}>{sank ? '沉沒' : '抵達'}</span>}
        </div>

        <p className="beat-trail">
          起始 {beat.start}
          {beat.steps.slice(0, stepsShown).map((s, i) => (
            <span key={i}>
              {' → '}
              {stepTitle(s, names).name} {signed(s.delta)}
            </span>
          ))}
          {has('outcome') && <> ＝ <b>{beat.final}</b></>}
        </p>

        {has('cargo') && (
          <div className="beat-cargo">
            <span className="beat-label">船上的貨</span>
            {cargo.map((g, i) => (
              <span key={i} className={`beat-crate good-${g}`} style={{ animationDelay: `${i * 90}ms` }}>
                {GOOD_LABELS[g].slice(0, 1)}
              </span>
            ))}
            {beat.armsConfiscated > 0 && <span className="beat-note down">軍火 {beat.armsConfiscated} 被沒收</span>}
          </div>
        )}

        <ul className="beat-cash">
          {beat.cash.slice(0, cashShown).map((c, i) => (
            <li key={i} className={c.playerId === viewer ? 'mine' : ''}>
              <b className={c.amount >= 0 ? 'up' : 'down'}>
                {c.amount >= 0 ? '+' : '−'}
                {Math.abs(c.amount)} G
              </b>
              <span>{c.playerId === viewer ? '你' : (names[c.playerId] ?? c.playerId)}</span>
              <small>{CASH_REASON_LABELS[c.reason]}</small>
            </li>
          ))}
          {beat.goods.slice(0, goodsShown).map((g, i) => (
            <li key={`g${i}`} className={g.playerId === viewer ? 'mine' : ''}>
              <b className="up">+{g.units} {GOOD_LABELS[g.good]}</b>
              <span>{g.playerId === viewer ? '你' : (names[g.playerId] ?? g.playerId)}</span>
              <small>{g.via === 'insurance' ? '航運保險保住' : '打撈公司撈到'}</small>
            </li>
          ))}
        </ul>

        <footer className="beat-foot">
          <button type="button" onClick={(e) => (e.stopPropagation(), jump(0))}>
            再看一次
          </button>
          <button type="button" onClick={(e) => (e.stopPropagation(), jump(total))}>
            跳到結果
          </button>
          <button type="button" className="primary" onClick={(e) => (e.stopPropagation(), done ? onDone?.() : next())}>
            {done ? '繼續' : '下一步 ▸'}
          </button>
        </footer>
      </div>
    </div>
  );
}
