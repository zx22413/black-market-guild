import type { CSSProperties } from 'react';
import { PLAYER_COLORS } from '../../scene/tableModel';
import { rng } from './paint';
import { MOCK_EVENTS, MOCK_HAND, MOCK_SEATS } from './mockData';
import type { Variant } from './MockScene';

/** Torn-paper outline: every edge gets small random notches, stable per seed. */
export function rough(seed: number, px = 3): string {
  const r = rng(seed);
  const pts: string[] = [];
  const j = () => `${((r() - 0.5) * 2 * px).toFixed(1)}px`;
  const n = 9;
  for (let i = 0; i <= n; i++) pts.push(`calc(${(i / n) * 100}% + ${j()}) calc(0% + ${j()})`);
  for (let i = 1; i <= n; i++) pts.push(`calc(100% + ${j()}) calc(${(i / n) * 100}% + ${j()})`);
  for (let i = n - 1; i >= 0; i--) pts.push(`calc(${(i / n) * 100}% + ${j()}) calc(100% + ${j()})`);
  for (let i = n - 1; i >= 1; i--) pts.push(`calc(0% + ${j()}) calc(${(i / n) * 100}% + ${j()})`);
  return `polygon(${pts.join(', ')})`;
}

const icon = (name: string, size: number): CSSProperties => ({ ['--icon' as string]: `url(/art/icons/${name}.svg)`, ['--size' as string]: `${size}px` });

export function Glyph({ name, size, className }: { readonly name: string; readonly size: number; readonly className?: string }) {
  return <i className={`mk-glyph ${className ?? ''}`} style={icon(name, size)} />;
}

export function Coin() {
  return <i className="mk-coin" />;
}

export function Diamond({ color }: { readonly color: string }) {
  return <i className="mk-diamond" style={{ background: color }} />;
}

/** Flat HUD's per-seat label: text straight on the scene, no plate behind it. */
function SeatLabel({ index, pin }: { readonly index: number; readonly pin: (id: string) => (el: HTMLElement | null) => void }) {
  const seat = MOCK_SEATS[index]!;
  return (
    <div ref={pin(`seat-${index}`)} className="mk-seat" title={seat.name}>
      <div className="mk-seat-name">
        <span className="mk-ellipsis">{seat.name}</span>
        {seat.ready && <span className="mk-ready">✓</span>}
      </div>
      <i className="mk-brush" style={{ background: PLAYER_COLORS[index], clipPath: rough(index * 7 + 3, 2) }} />
      <div className="mk-seat-cash">
        <Coin />
        {seat.cash}
      </div>
      {seat.status && (
        <div className="mk-seat-status">
          {seat.status.text}
          {seat.status.dot && <Diamond color={seat.status.dot} />}
        </div>
      )}
    </div>
  );
}

export function Hand() {
  return (
    <div className="mk-hand">
      {MOCK_HAND.map((card, i) => (
        <div key={card.id} className={`mk-card${card.id === 'pirate' ? ' lift' : ''}`} style={{ ['--i' as string]: i }}>
          <div className="mk-card-art">
            <Glyph name={`role-${card.id}`} size={46} />
          </div>
          <div className="mk-card-name">{card.name}</div>
          <span className="mk-stamp">{card.cost}</span>
        </div>
      ))}
      <div className="mk-tip" style={{ clipPath: rough(41, 2.5) }}>
        <div className="mk-tip-head">
          <b>海盜</b>
          <span>部署費 100 G</span>
        </div>
        <p>
          目標船<u>骰值</u> −1；船沉沒時與其他海盜均分 150 G <u>戰利品</u>。
        </p>
        <small>鎖定後不能更改</small>
      </div>
    </div>
  );
}

function Dock() {
  return (
    <div className="mk-dock">
      <div className="mk-prompt">
        <span className="mk-prompt-main">秘密部署角色</span>
        <span className="mk-prompt-hint">選一張角色牌</span>
        <span className="mk-info">i</span>
      </div>
      <div className="mk-actions">
        <button className="mk-btn" style={{ clipPath: rough(17) }}>
          不部署
        </button>
      </div>
    </div>
  );
}

function FlatTop() {
  return (
    <div className="mk-top">
      <div className="mk-round">
        <span className="mk-round-text">
          第 <b>1</b> 回合
        </span>
        <span className="mk-round-phase">部署角色</span>
        <span className="mk-pips">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <i key={i} className={i === 0 ? 'on' : ''} />
          ))}
        </span>
      </div>
      <div className="mk-event">
        <span className="mk-medal">
          <Glyph name={MOCK_EVENTS.market.icon} size={22} />
        </span>
        <span>
          <small>市場事件</small>
          {MOCK_EVENTS.market.name}
        </span>
      </div>
      <div className="mk-event muted">
        <span className="mk-medal">
          <Glyph name={MOCK_EVENTS.voyage.icon} size={20} />
        </span>
        <span>
          <small>航海事件</small>
          {MOCK_EVENTS.voyage.name}
        </span>
      </div>
    </div>
  );
}

function PropsTop() {
  return (
    <div className="mk-top">
      {[
        { cap: '市場事件', name: MOCK_EVENTS.market.name, icon: MOCK_EVENTS.market.icon, seed: 5, tilt: -1.5 },
        { cap: '航海事件', name: MOCK_EVENTS.voyage.name, icon: MOCK_EVENTS.voyage.icon, seed: 9, tilt: 1.2 },
      ].map((e) => (
        <div key={e.cap} className="mk-event-card" style={{ clipPath: rough(e.seed, 2), rotate: `${e.tilt}deg` }}>
          <Glyph name={e.icon} size={30} className="ink" />
          <span>
            <small>{e.cap}</small>
            {e.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function SysButtons() {
  return (
    <div className="mk-sys">
      <button title="航海日誌">誌</button>
      <button title="離開">✕</button>
    </div>
  );
}

function FlatLedger() {
  const me = MOCK_SEATS[0]!;
  return (
    <div className="mk-ledger">
      <div className="mk-ledger-name">
        你<i className="mk-brush" style={{ background: PLAYER_COLORS[0], clipPath: rough(2, 2) }} />
      </div>
      <div className="mk-ledger-cash">
        <Coin />
        {me.cash}
        <small>資金</small>
      </div>
      <div className="mk-ledger-row">資產估值 {me.worth}</div>
      <div className="mk-ledger-row secret">黑錢 0（只有你知道）</div>
    </div>
  );
}

function SealedNote() {
  return (
    <div className="mk-note" style={{ clipPath: rough(23, 2) }}>
      <span className="mk-seal">1</span>
      <small>只有你知道</small>
      黑錢 0
    </div>
  );
}

export function MockHud({ variant, pin }: { readonly variant: Variant; readonly pin: (id: string) => (el: HTMLElement | null) => void }) {
  return (
    <div className={`mk-hud mk-${variant}`}>
      {variant === 'flat' ? <FlatTop /> : <PropsTop />}
      <SysButtons />
      {variant === 'flat' && (
        <div className="mk-labels">
          {MOCK_SEATS.map((_, i) => (i === 0 ? null : <SeatLabel key={i} index={i} pin={pin} />))}
        </div>
      )}
      <div className="mk-bottom">
        {variant === 'flat' ? <FlatLedger /> : <SealedNote />}
        <Dock />
        <Hand />
      </div>
    </div>
  );
}
