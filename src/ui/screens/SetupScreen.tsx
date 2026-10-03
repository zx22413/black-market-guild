import { useState, type CSSProperties } from 'react';
import { BOT_STRATEGIES, type BotStrategy } from '../../bots';
import { RULES_V06 } from '../../game';
import type { SeatConfig } from '../../match';
import { iconUrl, sourcesUrl, uiArtUrl, uiArtVars, uiBackdropUrl } from '../art';
import type { SessionOptions } from '../session/gameSession';
import './setup.css';

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
  { label: '同機輪流', seats: [human('玩家一'), human('玩家二'), human('玩家三')] },
  { label: '觀戰 Bot', seats: [bot(0), bot(1, 'cautious'), bot(2, 'aggressive'), bot(3, 'opportunist')] },
];

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
}

function toSeatConfig(seat: SeatDraft, i: number): SeatConfig {
  const name = seat.name.trim() || `玩家 ${i + 1}`;
  return seat.kind === 'bot' ? { kind: 'bot', name, strategy: seat.strategy } : { kind: 'local-human', name };
}

const sameSeats = (a: readonly SeatDraft[], b: readonly SeatDraft[]): boolean =>
  a.length === b.length && a.every((s, i) => s.kind === b[i]!.kind && s.name === b[i]!.name && s.strategy === b[i]!.strategy);

interface SeatCardProps {
  readonly index: number;
  readonly seat: SeatDraft;
  readonly removable: boolean;
  readonly onChange: (patch: Partial<SeatDraft>) => void;
  readonly onRemove: () => void;
}

function SeatCard({ index, seat, removable, onChange, onRemove }: SeatCardProps) {
  return (
    <li className="seat-card">
      <span className="seat-no">{index + 1}P</span>
      <div className="seat-slot">
        <div className="kind-toggle" role="radiogroup" aria-label={`座位 ${index + 1} 類型`}>
          {(['local-human', 'bot'] as const).map((kind) => (
            <button
              key={kind}
              role="radio"
              aria-checked={seat.kind === kind}
              className={seat.kind === kind ? 'on' : ''}
              onClick={() => onChange({ kind })}
            >
              {kind === 'bot' ? '電腦' : '真人'}
            </button>
          ))}
        </div>
        {seat.kind === 'bot' ? (
          <label className="pill-select">
            <span>個性</span>
            <select value={seat.strategy} onChange={(e) => onChange({ strategy: e.target.value as BotStrategy })}>
              {BOT_STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {STRATEGY_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="seat-hint">由你操作</span>
        )}
      </div>
      <label className="name-line">
        <input value={seat.name} maxLength={12} placeholder="商會名稱" onChange={(e) => onChange({ name: e.target.value })} />
        <img src={uiArtUrl('icon-pencil')} alt="" />
      </label>
      {removable && (
        <button className="seat-remove" aria-label={`移除座位 ${index + 1}`} onClick={onRemove}>
          ✕
        </button>
      )}
    </li>
  );
}

interface SetupScreenProps {
  readonly onStart: (options: SessionOptions) => void;
  readonly onOnline: () => void;
}

export function SetupScreen({ onStart, onOnline }: SetupScreenProps) {
  const [seats, setSeats] = useState<readonly SeatDraft[]>(PRESETS[1]!.seats);
  const [seed, setSeed] = useState(randomSeed);
  const { min, max } = RULES_V06.players;

  const updateSeat = (index: number, patch: Partial<SeatDraft>) =>
    setSeats(seats.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const style = { ...uiArtVars(), '--setup-backdrop': `url(${uiBackdropUrl})` } as CSSProperties;

  return (
    <main className="setup" style={style}>
      <div className="setup-board">
        <div className="setup-plaque">
          <h1>黑市商會</h1>
        </div>
        <img className="setup-rope rope-a" src={uiArtUrl('rope')} alt="" />
        <img className="setup-rope rope-b" src={uiArtUrl('rope')} alt="" />
        <section className="setup-paper">
          <p className="setup-lead">選擇模式、設定每個座位後，即可開始對局</p>

          <div className="setup-modes" role="group" aria-label="對局模式">
            {PRESETS.map((p) => (
              <button key={p.label} className={`tag-button${sameSeats(seats, p.seats) ? ' on' : ''}`} onClick={() => setSeats(p.seats)}>
                {p.label}
              </button>
            ))}
            <button className="tag-button" onClick={onOnline}>
              線上房間
            </button>
          </div>

          <ol className="seat-grid">
            {seats.map((seat, i) => (
              <SeatCard
                key={i}
                index={i}
                seat={seat}
                removable={seats.length > min}
                onChange={(patch) => updateSeat(i, patch)}
                onRemove={() => setSeats(seats.filter((_, j) => j !== i))}
              />
            ))}
            {seats.length < max && (
              <li className="seat-card">
                <span className="seat-no">{seats.length + 1}P</span>
                <button className="seat-slot seat-add" onClick={() => setSeats([...seats, bot(seats.length)])}>
                  <img src={uiArtUrl('icon-plus')} alt="" />
                  <span>新增座位</span>
                </button>
              </li>
            )}
          </ol>

          <div className="seed-row">
            <label className="name-line">
              <span>Seed</span>
              <input type="number" value={seed} onChange={(e) => setSeed(Number.parseInt(e.target.value, 10) || 0)} />
            </label>
            <button className="round-button" aria-label="隨機 seed" title="隨機 seed" onClick={() => setSeed(randomSeed())}>
              <img src={iconUrl('dice')} alt="" />
            </button>
          </div>
        </section>
      </div>

      <button className="arrow-button" onClick={() => onStart({ seed, seats: seats.map(toSeatConfig) })}>
        開始對局
      </button>

      <footer className="credits">
        Black Market Guild・{RULES_V06.version}・圖示：Lorc、Delapouite、Skoll／game-icons.net（CC BY 3.0，已改色）・畫作：Wikimedia
        Commons 公有領域・
        <a href={sourcesUrl} target="_blank" rel="noreferrer">
          素材來源
        </a>
      </footer>
    </main>
  );
}
