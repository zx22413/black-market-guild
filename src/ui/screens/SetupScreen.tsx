import { useState } from 'react';
import { BOT_STRATEGIES, type BotStrategy } from '../../bots';
import { RULES_V06 } from '../../game';
import type { SeatConfig } from '../../match';
import { paintingUrl, sourcesUrl } from '../art';
import type { SessionOptions } from '../session/gameSession';

const STRATEGY_LABELS: Readonly<Record<BotStrategy, string>> = {
  random: '隨機',
  balanced: '穩健',
  cautious: '謹慎',
  aggressive: '激進',
  opportunist: '投機',
};

const BOT_NAMES = ['凡德商行', '黑潮會', '金錨公會', '霧港商團'];

type SeatKind = 'local-human' | 'bot';

interface SeatDraft {
  readonly kind: SeatKind;
  readonly name: string;
  readonly strategy: BotStrategy;
}

const human = (name: string): SeatDraft => ({ kind: 'local-human', name, strategy: 'balanced' });
const bot = (i: number, strategy: BotStrategy = 'balanced'): SeatDraft => ({
  kind: 'bot',
  name: BOT_NAMES[i] ?? `Bot ${i + 1}`,
  strategy,
});

const PRESETS: readonly { readonly label: string; readonly seats: readonly SeatDraft[] }[] = [
  { label: '1 對 2', seats: [human('你'), bot(1), bot(2, 'aggressive')] },
  { label: '1 對 3', seats: [human('你'), bot(1), bot(2, 'aggressive'), bot(3, 'opportunist')] },
  { label: '同機輪流（3 人）', seats: [human('玩家一'), human('玩家二'), human('玩家三')] },
  { label: '觀戰 Bot 對局', seats: [bot(0), bot(1, 'cautious'), bot(2, 'aggressive'), bot(3, 'opportunist')] },
];

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
}

function toSeatConfig(seat: SeatDraft, i: number): SeatConfig {
  const name = seat.name.trim() || `玩家 ${i + 1}`;
  return seat.kind === 'bot' ? { kind: 'bot', name, strategy: seat.strategy } : { kind: 'local-human', name };
}

interface SetupScreenProps {
  readonly onStart: (options: SessionOptions) => void;
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [seats, setSeats] = useState<readonly SeatDraft[]>(PRESETS[1]!.seats);
  const [seed, setSeed] = useState(randomSeed);
  const { min, max } = RULES_V06.players;

  const updateSeat = (index: number, patch: Partial<SeatDraft>) =>
    setSeats(seats.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  return (
    <main className="setup" style={{ backgroundImage: `url(${paintingUrl('harbor')})` }}>
      <h1 className="title">黑市商會</h1>
      <p className="subtitle">Black Market Guild・{RULES_V06.version}</p>
      <section className="panel">
        <h2>選擇模式</h2>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => setSeats(p.seats)}>
              {p.label}
            </button>
          ))}
        </div>
        <h2>座位</h2>
        <ol className="seats">
          {seats.map((seat, i) => (
            <li key={i}>
              <select value={seat.kind} onChange={(e) => updateSeat(i, { kind: e.target.value as SeatKind })}>
                <option value="local-human">真人</option>
                <option value="bot">Bot</option>
              </select>
              <input value={seat.name} maxLength={12} onChange={(e) => updateSeat(i, { name: e.target.value })} />
              {seat.kind === 'bot' && (
                <select
                  value={seat.strategy}
                  onChange={(e) => updateSeat(i, { strategy: e.target.value as BotStrategy })}
                >
                  {BOT_STRATEGIES.map((s) => (
                    <option key={s} value={s}>
                      {STRATEGY_LABELS[s]}
                    </option>
                  ))}
                </select>
              )}
              {seats.length > min && (
                <button className="ghost" onClick={() => setSeats(seats.filter((_, j) => j !== i))}>
                  移除
                </button>
              )}
            </li>
          ))}
        </ol>
        {seats.length < max && <button onClick={() => setSeats([...seats, bot(seats.length)])}>＋ 新增座位</button>}
        <div className="seed-row">
          <label>
            Seed{' '}
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number.parseInt(e.target.value, 10) || 0)}
            />
          </label>
          <button className="ghost" onClick={() => setSeed(randomSeed())}>
            隨機
          </button>
        </div>
        <button className="primary" onClick={() => onStart({ seed, seats: seats.map(toSeatConfig) })}>
          開始對局
        </button>
      </section>
      <footer className="credits">
        圖示：Lorc、Delapouite、Skoll／game-icons.net（CC BY 3.0，已改色）・畫作：Wikimedia Commons 公有領域・
        <a href={sourcesUrl} target="_blank" rel="noreferrer">
          素材來源
        </a>
      </footer>
    </main>
  );
}
