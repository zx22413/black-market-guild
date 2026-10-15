import { useState } from 'react';
import { BOT_STRATEGIES, type BotStrategy } from '../../v07/bots';
import { RULES_V07 } from '../../v07/game';
import type { SeatConfig } from '../../v07/match';
import { brokerTargetRules } from '../session/experiments';
import type { SessionOptions } from '../session/gameSession';

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

const PRESETS: readonly { readonly label: string; readonly seats: readonly SeatDraft[] }[] = [
  { label: '1 對 2', seats: [human('你'), bot(1), bot(2, 'aggressive')] },
  { label: '1 對 3', seats: [human('你'), bot(1), bot(2, 'aggressive'), bot(3, 'builder')] },
  { label: '同機輪流', seats: [human('玩家一'), human('玩家二'), human('玩家三')] },
  { label: '觀戰 Bot', seats: [bot(0), bot(1, 'cautious'), bot(2, 'aggressive'), bot(3, 'builder')] },
];

const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;

function toSeatConfig(seat: SeatDraft, i: number): SeatConfig {
  const name = seat.name.trim() || `玩家 ${i + 1}`;
  return seat.kind === 'bot' ? { kind: 'bot', name, strategy: seat.strategy } : { kind: 'local-human', name };
}

interface SetupScreenProps {
  readonly onStart: (options: SessionOptions) => void;
  readonly onOnline: () => void;
}

export function SetupScreen({ onStart, onOnline }: SetupScreenProps) {
  const [seats, setSeats] = useState<readonly SeatDraft[]>(PRESETS[1]!.seats);
  const [seed, setSeed] = useState(randomSeed);
  const [brokerTarget, setBrokerTarget] = useState(false);
  const [ownUp, setOwnUp] = useState(false);
  const { min, max } = RULES_V07.players;
  const update = (index: number, patch: Partial<SeatDraft>) => setSeats(seats.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  return (
    <main className="v7-setup">
      <h1>黑市商會 <small>V0.7</small></h1>
      <p className="v7-muted">選擇模式、設定每個座位後開始對局。</p>

      <div className="v7-chips" role="group" aria-label="對局模式">
        {PRESETS.map((p) => (
          <button key={p.label} className="v7-btn" onClick={() => setSeats(p.seats)}>
            {p.label}
          </button>
        ))}
        <button className="v7-btn" onClick={onOnline}>
          線上房間
        </button>
      </div>

      <ol className="v7-seats">
        {seats.map((seat, i) => (
          <li key={i}>
            <span className="v7-seat-no">{i + 1}P</span>
            <div className="v7-kind" role="radiogroup" aria-label={`座位 ${i + 1} 類型`}>
              {(['local-human', 'bot'] as const).map((kind) => (
                <button key={kind} role="radio" aria-checked={seat.kind === kind} className={seat.kind === kind ? 'on' : ''} onClick={() => update(i, { kind })}>
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
              <button className="v7-x" aria-label={`移除座位 ${i + 1}`} onClick={() => setSeats(seats.filter((_, j) => j !== i))}>
                ✕
              </button>
            )}
          </li>
        ))}
        {seats.length < max && (
          <li>
            <span className="v7-seat-no">{seats.length + 1}P</span>
            <button className="v7-btn" onClick={() => setSeats([...seats, bot(seats.length)])}>
              ＋ 新增座位
            </button>
          </li>
        )}
      </ol>

      <label className="v7-seed">
        Seed
        <input type="number" value={seed} onChange={(e) => setSeed(Number.parseInt(e.target.value, 10) || 0)} />
        <button className="v7-btn" onClick={() => setSeed(randomSeed())}>
          隨機
        </button>
      </label>

      <label className="v7-option">
        <input type="checkbox" checked={brokerTarget} onChange={(e) => setBrokerTarget(e.target.checked)} />
        實驗規則：莊家押漲跌時要指定一艘對手的船；押對的話，那艘船賣該商品的價格往同方向多動 2 格（每單位 50 G），押跌時差額歸莊家
      </label>

      {brokerTarget && (
        <label className="v7-option">
          <input type="checkbox" checked={ownUp} onChange={(e) => setOwnUp(e.target.checked)} />
          押漲改成指定「自己」的船（押跌仍指定對手的船）：押對時自己那艘船賣該商品多拿 2 格，由銀行補貼
        </label>
      )}

      <button
        className="v7-primary"
        onClick={() => onStart({ seed, seats: seats.map(toSeatConfig), ...(brokerTarget ? { rules: brokerTargetRules(ownUp) } : {}) })}
      >
        開始對局
      </button>
      <p className="v7-muted v7-credit">規則 {RULES_V07.version}・第一版介面（面板）・桌遊場景版製作中</p>
    </main>
  );
}
