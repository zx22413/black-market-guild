import { useEffect, useState } from 'react';
import type React from 'react';
import { soundEngine } from '../audio/soundEngine';
import { useSoundOnce } from '../audio/useUiSounds';
import type { PlayerId } from '../../v07/game';
import { BUILDING_LABELS, WEALTH_RULE_TEXT } from '../labels';
import type { ResultRow } from './resultModel';

// The end of the match (§3, §13) as a full-screen card over the dimmed table. Places are revealed
// from last to first; each row adds up its total wealth in front of you — cash, plus every
// building at half its cash cost — and says how a tie was broken. A small line shows each
// guild's cash after every round.

/** One place every this many ms, last place first; the winner gets a longer pause before it. */
const ROW_MS = 1300;
const WINNER_PAUSE_MS = 700;
const COUNT_MS = 700;

/**
 * The accents of the closing flourish (`sfx-result-open.ogg`, played as the card pops up), in ms:
 * the card bumps on the first two, and on the last, the final chord, the title glows and a burst of
 * gold goes off behind the card.
 */
export const FLOURISH_MS = { first: 460, second: 840, chord: 1300 } as const;
const FLOURISH_STYLE = {
  '--flourish-1': `${FLOURISH_MS.first}ms`,
  '--flourish-2': `${FLOURISH_MS.second}ms`,
  '--flourish-chord': `${FLOURISH_MS.chord}ms`,
} as React.CSSProperties;
/** The burst's sparks: where each flies to (fractions of the spark distance). */
const SPARKS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 + 0.2;
  const r = i % 2 ? 0.75 : 1;
  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r };
});

/**
 * What the card offers after the reveal besides going back to the menu: play again at once
 * (single player, or the host of an online room), or wait for the host to (online guests).
 */
export type Rematch = { readonly kind: 'now'; readonly onRematch: () => void } | { readonly kind: 'host-decides' };

function useCountUp(target: number, running: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / COUNT_MS);
      setValue(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, running]);
  return running ? value : 0;
}

/** Cash after each round as a tiny line; the dot marks the last round. */
function Sparkline({ values, color }: { readonly values: readonly number[]; readonly color: string }) {
  if (values.length < 2) return null;
  const w = 96;
  const h = 26;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const y = (v: number) => (max === min ? h / 2 : h - 3 - ((v - min) / (max - min)) * (h - 6));
  const x = (i: number) => 3 + (i / (values.length - 1)) * (w - 6);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg className="result-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-label={`每回合現金：${values.join('、')}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1]!)} r="3" fill={color} />
    </svg>
  );
}

function Row({ row, shown, name, color, isViewer }: { readonly row: ResultRow; readonly shown: boolean; readonly name: string; readonly color: string; readonly isViewer: boolean }) {
  const wealth = useCountUp(row.wealth, shown);
  return (
    <li className={`result-row ${shown ? 'in' : ''} ${row.winner ? 'winner' : ''} ${isViewer ? 'mine' : ''}`} style={{ borderColor: color }}>
      <span className="result-rank">{shown ? row.rank : '?'}</span>
      <span className="result-name">
        <b>{shown ? name : '…'}</b>
        {shown && <Sparkline values={row.cashByRound} color={color} />}
      </span>
      {shown && (
        <span className="result-sum">
          <span>現金 {row.cash}</span>
          {row.buildings.map((b) => (
            <span key={b.id}>
              ＋ {BUILDING_LABELS[b.id]} {b.value}
            </span>
          ))}
          {row.tieBreak === 'cash' && <small>總財富同分，現金較多者在前</small>}
          {row.tieBreak === 'shared' && <small>總財富與現金都相同，並列</small>}
        </span>
      )}
      <span className="result-wealth">{shown ? `${wealth} G` : ''}</span>
      {shown && row.winner && <span className="result-stamp">勝利</span>}
    </li>
  );
}

export interface ResultCardProps {
  readonly rows: readonly ResultRow[];
  readonly nameOf: (id: PlayerId) => string;
  readonly colorOf: (id: PlayerId) => string;
  /** Highlighted as 「你」; null on a hot-seat table (everyone is looking). */
  readonly viewer: PlayerId | null;
  /** Rounds in the match (§3). */
  readonly rounds: number;
  /** Back to the main menu. */
  readonly onRestart: () => void;
  readonly rematch?: Rematch | undefined;
}

export function ResultCard({ rows, nameOf, colorOf, viewer, rounds, onRestart, rematch }: ResultCardProps) {
  // Reveal from the last row up; the winner(s) last, after a pause.
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (revealed >= rows.length) return;
    const nextIsWinner = rows[rows.length - 1 - revealed]?.winner ?? false;
    const timer = setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? 600 : ROW_MS + (nextIsWinner ? WINNER_PAUSE_MS : 0));
    return () => clearTimeout(timer);
  }, [revealed, rows]);
  const done = revealed >= rows.length;
  // The card pops up on a steel-drum flourish: the match is over.
  useSoundOnce('result-open');
  // The winner is out: the victory horns.
  useEffect(() => {
    if (done) soundEngine.playSfx('match-end-horn');
  }, [done]);
  const winners = rows.filter((r) => r.winner).map((r) => (r.playerId === viewer ? '你' : nameOf(r.playerId)));

  return (
    <div className="beat-backdrop result-backdrop" role="dialog" aria-modal="true" aria-label="最終結算" onClick={() => setRevealed(rows.length)} style={FLOURISH_STYLE}>
      <div className="flourish-burst" aria-hidden="true">
        {SPARKS.map((p, i) => (
          <i key={i} style={{ '--dx': p.dx, '--dy': p.dy } as React.CSSProperties} />
        ))}
      </div>
      <div className="beat-card result" onClick={(e) => e.stopPropagation()}>
        <header className="beat-head">
          <span>第 {rounds} 回合結束</span>
          <strong>{done ? `${winners.join('、')} 獲勝` : '最終結算'}</strong>
        </header>
        <p className="result-rule">{WEALTH_RULE_TEXT}</p>
        <ol className="result-rows">
          {rows.map((row, i) => (
            <Row
              key={row.playerId}
              row={row}
              shown={rows.length - 1 - i < revealed}
              name={row.playerId === viewer ? '你' : nameOf(row.playerId)}
              color={colorOf(row.playerId)}
              isViewer={row.playerId === viewer}
            />
          ))}
        </ol>
        <footer className="beat-foot">
          {!done && (
            <button type="button" onClick={() => setRevealed(rows.length)}>
              全部揭曉
            </button>
          )}
          {done && rematch?.kind === 'host-decides' && <span className="result-wait">等房主開下一局…</span>}
          {done && (
            <button type="button" className={rematch?.kind === 'now' ? '' : 'primary'} onClick={onRestart}>
              回主選單
            </button>
          )}
          {done && rematch?.kind === 'now' && (
            <button type="button" className="primary" onClick={rematch.onRematch}>
              再來一局
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
