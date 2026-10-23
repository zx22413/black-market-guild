import { useState, type CSSProperties } from 'react';
import { BOT_STRATEGIES, type BotStrategy } from '../../v07/bots';
import { RULES_V07 } from '../../v07/game';
import type { SeatConfig } from '../../v07/match';
import { PLAYER_COLORS } from '../../ui/scene/tableModel';
import type { SessionOptions } from '../session/gameSession';

// Seat drafts and presets for a match on this device; the seat list is folded away under 「調整座位」.

const STRATEGY_LABELS: Readonly<Record<BotStrategy, string>> = {
  random: '隨機',
  balanced: '穩健',
  cautious: '謹慎',
  aggressive: '激進',
  builder: '建設',
};

const BOT_NAMES = ['凡德商行', '黑潮會', '金錨公會', '霧港商團'];

interface SeatDraft {
  readonly kind: 'local-human' | 'bot';
  readonly name: string;
  readonly strategy: BotStrategy;
}

const human = (name: string): SeatDraft => ({ kind: 'local-human', name, strategy: 'balanced' });
const bot = (i: number, strategy: BotStrategy = 'balanced'): SeatDraft => ({ kind: 'bot', name: BOT_NAMES[i] ?? `Bot ${i + 1}`, strategy });

const PRESETS: readonly { readonly label: string; readonly note: string; readonly seats: readonly SeatDraft[] }[] = [
  { label: '1 對 2', note: '你對兩台電腦', seats: [human('你'), bot(1), bot(2, 'aggressive')] },
  { label: '1 對 3', note: '你對三台電腦', seats: [human('你'), bot(1), bot(2, 'aggressive'), bot(3, 'builder')] },
  { label: '同機輪流', note: '一台裝置傳著玩', seats: [human('玩家一'), human('玩家二'), human('玩家三')] },
  { label: '觀戰', note: '看四台電腦對打', seats: [bot(0), bot(1, 'cautious'), bot(2, 'aggressive'), bot(3, 'builder')] },
];

const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;

function toSeatConfig(seat: SeatDraft, i: number): SeatConfig {
  const name = seat.name.trim() || `玩家 ${i + 1}`;
  return seat.kind === 'bot' ? { kind: 'bot', name, strategy: seat.strategy } : { kind: 'local-human', name };
}

interface LocalSetupProps {
  readonly onStart: (options: SessionOptions) => void;
  readonly onBack: () => void;
}

/** Single player and hot seat: pick a preset, adjust the seats if you like, start. */
export function LocalSetup({ onStart, onBack }: LocalSetupProps) {
  const [preset, setPreset] = useState(1);
  const [seats, setSeats] = useState<readonly SeatDraft[]>(PRESETS[1]!.seats);
  const [seed, setSeed] = useState(randomSeed);

  return (
    <main className="menu-panel menu-page">
      <h2>單機對局</h2>
      <div className="menu-presets" role="radiogroup" aria-label="對局模式">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            role="radio"
            aria-checked={preset === i}
            className={`menu-preset ${preset === i ? 'on' : ''}`}
            onClick={() => {
              setPreset(i);
              setSeats(p.seats);
            }}
          >
            <strong>{p.label}</strong>
            <small>{p.note}</small>
          </button>
        ))}
      </div>

      <details className="menu-more">
        <summary>調整座位</summary>
        <SeatList seats={seats} onChange={setSeats} />
        <label className="menu-seed">
          Seed
          <input type="number" value={seed} onChange={(e) => setSeed(Number.parseInt(e.target.value, 10) || 0)} />
          <button type="button" className="menu-small" onClick={() => setSeed(randomSeed())}>
            隨機
          </button>
        </label>
      </details>

      <div className="menu-foot">
        <button type="button" className="menu-small" onClick={onBack}>
          返回
        </button>
        <button type="button" className="menu-go" onClick={() => onStart({ seed, seats: seats.map(toSeatConfig) })}>
          開始對局
        </button>
      </div>
    </main>
  );
}

function SeatList({ seats, onChange }: { readonly seats: readonly SeatDraft[]; readonly onChange: (seats: readonly SeatDraft[]) => void }) {
  const { min, max } = RULES_V07.players;
  const update = (index: number, patch: Partial<SeatDraft>) => onChange(seats.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  return (
    <ol className="menu-seat-list">
      {seats.map((seat, i) => (
        <li key={i} className="menu-seat-row" style={{ '--seat': PLAYER_COLORS[i % PLAYER_COLORS.length] } as CSSProperties}>
          <span className="menu-seat-no">{i + 1}P</span>
          <div className="menu-kind" role="radiogroup" aria-label={`座位 ${i + 1} 類型`}>
            {(['local-human', 'bot'] as const).map((kind) => (
              <button key={kind} type="button" role="radio" aria-checked={seat.kind === kind} className={seat.kind === kind ? 'on' : ''} onClick={() => update(i, { kind })}>
                {kind === 'bot' ? '電腦' : '真人'}
              </button>
            ))}
          </div>
          {seat.kind === 'bot' && (
            <select aria-label="個性" value={seat.strategy} onChange={(e) => update(i, { strategy: e.target.value as BotStrategy })}>
              {BOT_STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {STRATEGY_LABELS[s]}
                </option>
              ))}
            </select>
          )}
          <input value={seat.name} maxLength={12} placeholder="商會名稱" onChange={(e) => update(i, { name: e.target.value })} />
          {seats.length > min && (
            <button type="button" className="menu-x" aria-label={`移除座位 ${i + 1}`} onClick={() => onChange(seats.filter((_, j) => j !== i))}>
              ✕
            </button>
          )}
        </li>
      ))}
      {seats.length < max && (
        <li>
          <button type="button" className="menu-small" onClick={() => onChange([...seats, bot(seats.length)])}>
            ＋ 新增座位
          </button>
        </li>
      )}
    </ol>
  );
}
