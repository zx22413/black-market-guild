import { useEffect, useState } from 'react';
import type { PlayerId } from '../../v07/game';
import { BUILDING_LABELS } from '../labels';
import type { ResultRow } from './resultModel';

// The end of the match (§3, §13) as a full-screen card over the dimmed table. Places are revealed
// from last to first; each row adds up its total wealth in front of you — cash, plus every
// building at half its cash cost — and says how a tie was broken. A small line shows each
// guild's cash after every round.

/** One place every this many ms, last place first; the winner gets a longer pause before it. */
const ROW_MS = 1300;
const WINNER_PAUSE_MS = 700;
const COUNT_MS = 700;

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
  readonly onRestart: () => void;
}

export function ResultCard({ rows, nameOf, colorOf, viewer, rounds, onRestart }: ResultCardProps) {
  // Reveal from the last row up; the winner(s) last, after a pause.
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (revealed >= rows.length) return;
    const nextIsWinner = rows[rows.length - 1 - revealed]?.winner ?? false;
    const timer = setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? 600 : ROW_MS + (nextIsWinner ? WINNER_PAUSE_MS : 0));
    return () => clearTimeout(timer);
  }, [revealed, rows]);
  const done = revealed >= rows.length;
  const winners = rows.filter((r) => r.winner).map((r) => (r.playerId === viewer ? '你' : nameOf(r.playerId)));

  return (
    <div className="beat-backdrop result-backdrop" role="dialog" aria-modal="true" aria-label="最終結算" onClick={() => setRevealed(rows.length)}>
      <div className="beat-card result" onClick={(e) => e.stopPropagation()}>
        <header className="beat-head">
          <span>第 {rounds} 回合結束</span>
          <strong>{done ? `${winners.join('、')} 獲勝` : '最終結算'}</strong>
        </header>
        <p className="result-rule">總財富 ＝ 現金 ＋ 持有建築現金成本的一半；倉庫裡的材料不計分。同分比現金，現金也相同就並列。</p>
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
          {done && (
            <button type="button" className="primary" onClick={onRestart}>
              再玩一局
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
