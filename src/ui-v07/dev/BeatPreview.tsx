import { useMemo, useState } from 'react';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../v07/match';
import { ReceiptCard } from '../beats/ReceiptCard';
import { ShipBeatStage } from '../beats/ShipBeatStage';
import { buildReceipt, buildShipBeat, type ShipBeat } from '../beats/shipBeat';

// Dev-only preview of the ship-resolution beat at /v07.html?dev=beat (&seed=7). Plays a seeded
// all-bot match and lets you pick any resolved ship; the viewer is the first seat ("你").

const SEATS: SeatConfig[] = [
  { kind: 'bot', name: '你', strategy: 'aggressive' },
  { kind: 'bot', name: '黑潮會', strategy: 'aggressive' },
  { kind: 'bot', name: '金錨公會', strategy: 'balanced' },
  { kind: 'bot', name: '霧港商團', strategy: 'builder' },
];

/** Pirates first: the beat this prototype is meant to test. */
const interest = (b: ShipBeat): number =>
  (b.steps.some((s) => s.kind === 'pirate') ? 4 : 0) + (b.outcome === 'sank' ? 2 : 0) + (b.steps.length > 1 ? 1 : 0);

export function BeatPreview() {
  const seed = Number(new URLSearchParams(location.search).get('seed') ?? 7) || 7;
  const { beats, names, events } = useMemo(() => {
    const setup = setupFromSeats({ seed, seats: SEATS });
    const log = runMatchSync(setup, setup.bots);
    const ids = log.events.flatMap((e) => (e.type === 'ship-resolved' ? [e.shipId] : []));
    return {
      beats: ids.map((id) => buildShipBeat(log.events, id)).filter((b): b is ShipBeat => b !== null),
      names: Object.fromEntries(setup.players.map((p) => [p.id, p.name])),
      events: log.events,
    };
  }, [seed]);
  const [index, setIndex] = useState(() => {
    const best = Math.max(...beats.map(interest));
    return Math.max(0, beats.findIndex((b) => interest(b) === best));
  });
  const [view, setView] = useState<'beat' | 'receipt' | 'table'>('beat');
  const beat = beats[index];
  const viewer = 'p1';

  return (
    <div className="beat-preview">
      <svg className="beat-preview-table" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <rect width="640" height="360" fill="#5fa9b8" />
        {[
          [320, 70],
          [120, 180],
          [520, 180],
          [320, 300],
        ].map(([x, y]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="70" ry="34" fill="#e9dcb0" />
        ))}
        <rect x="230" y="140" width="180" height="80" rx="6" fill="#5b4636" />
      </svg>

      <div className="beat-preview-bar">
        <label>
          船{' '}
          <select value={index} onChange={(e) => (setIndex(Number(e.target.value)), setView('beat'))}>
            {beats.map((b, i) => (
              <option key={b.shipId} value={i}>
                第 {b.round} 回合 · {names[b.owner]} · {b.outcome === 'sank' ? '沉沒' : '抵達'}
                {b.steps.some((s) => s.kind === 'pirate') ? ' · 海盜' : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setView('beat')}>
          播放
        </button>
        <button type="button" onClick={() => setView('receipt')}>
          帳單
        </button>
        <span>seed {seed}</span>
      </div>

      {beat && view === 'beat' && <ShipBeatStage key={`${beat.shipId}-${index}`} beat={beat} names={names} viewer={viewer} onDone={() => setView('receipt')} />}
      {beat && view === 'receipt' && <ReceiptCard round={beat.round} viewer={viewer} {...buildReceipt(events, beat.round, viewer)} onClose={() => setView('table')} />}
    </div>
  );
}
