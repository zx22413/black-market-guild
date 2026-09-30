import type { CSSProperties, ReactNode } from 'react';
import { PLAYER_COLORS } from '../../scene/tableModel';
import { Coin, Diamond, Glyph, Hand, rough } from './MockHud';
import { MOCK_EVENTS, MOCK_SEATS } from './mockData';
import './uiMix.css';

/**
 * Third mock-up (`v=mix`): three materials with fixed jobs — pale wood for standing
 * information (name boards, round, own ledger, buttons), parchment for things to read (cards,
 * notices, prompt, tooltips), and small saturated accents (seat-colored cloth, wax, stamps, coins).
 */

type Pin = (id: string) => (el: HTMLElement | null) => void;

/** A pale wooden board with a slightly uneven cut; `ribbon` wraps seat-colored cloth round its left end. */
function Board({ seed, ribbon, className, children }: { readonly seed: number; readonly ribbon?: string | undefined; readonly className?: string; readonly children: ReactNode }) {
  return (
    <div className={`mx-board-wrap ${className ?? ''}`}>
      <div className="mx-board" style={{ clipPath: rough(seed, 1.4) }}>
        {children}
      </div>
      {ribbon && <i className="mx-ribbon" style={{ '--c': ribbon } as CSSProperties} />}
    </div>
  );
}

function Stamp({ children }: { readonly children: ReactNode }) {
  return <span className="mx-stamp">{children}</span>;
}

function SeatBoard({ index, pin }: { readonly index: number; readonly pin: Pin }) {
  const seat = MOCK_SEATS[index]!;
  return (
    <div ref={pin(`seat-${index}`)} className="mx-seat" title={seat.name}>
      <Board seed={index * 13 + 1} ribbon={PLAYER_COLORS[index]}>
        <div className="mx-seat-name">
          <span className="mk-ellipsis">{seat.name}</span>
          {seat.ready && <span className="mx-check">✓</span>}
        </div>
        <div className="mx-seat-cash">
          <Coin />
          {seat.cash}
        </div>
      </Board>
      {seat.status && (
        <Stamp>
          {seat.status.text}
          {seat.status.dot && <Diamond color={seat.status.dot} />}
        </Stamp>
      )}
    </div>
  );
}

function Notice({ cap, name, icon, seed, tilt }: { readonly cap: string; readonly name: string; readonly icon: string; readonly seed: number; readonly tilt: number }) {
  return (
    <div className="mx-notice" style={{ rotate: `${tilt}deg` }}>
      <div className="mx-notice-paper" style={{ clipPath: rough(seed, 2) }}>
        <Glyph name={icon} size={24} className="ink" />
        <span>
          <small>{cap}</small>
          {name}
        </span>
      </div>
      <i className="mx-pin" />
    </div>
  );
}

function Top() {
  return (
    <div className="mx-top">
      <Board seed={3} className="mx-round">
        <span className="mx-round-text">
          第 <b>1</b> 回合
        </span>
        <span className="mx-pips">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <i key={i} className={i === 0 ? 'on' : ''} />
          ))}
        </span>
      </Board>
      <Notice cap="市場事件" name={MOCK_EVENTS.market.name} icon={MOCK_EVENTS.market.icon} seed={5} tilt={-2} />
      <Notice cap="航海事件" name="鎖定後揭曉" icon={MOCK_EVENTS.voyage.icon} seed={9} tilt={1.5} />
    </div>
  );
}

function Ledger() {
  const me = MOCK_SEATS[0]!;
  return (
    <div className="mx-ledger">
      <Board seed={21} ribbon={PLAYER_COLORS[0]}>
        <div className="mx-ledger-name">你</div>
        <div className="mx-ledger-cash">
          <Coin />
          {me.cash}
        </div>
      </Board>
      <span className="mx-seal" title="只有你知道：黑錢 0、資產估值 200">
        密
      </span>
    </div>
  );
}

function Dock() {
  return (
    <div className="mk-dock">
      <div className="mx-prompt" style={{ clipPath: rough(31, 2) }}>
        <b>秘密部署角色</b>
        <span>選一張角色牌</span>
        <span className="mk-info">i</span>
      </div>
      <div className="mk-actions">
        <Board seed={17} className="mx-button">
          不部署
        </Board>
      </div>
    </div>
  );
}

export function MixHud({ pin }: { readonly pin: Pin }) {
  return (
    <div className="mk-hud mk-mix">
      <Top />
      <div className="mx-sys">
        <button title="航海日誌">誌</button>
        <button title="離開">✕</button>
      </div>
      <div className="mk-labels">{MOCK_SEATS.map((_, i) => (i === 0 ? null : <SeatBoard key={i} index={i} pin={pin} />))}</div>
      <div className="mk-bottom">
        <Ledger />
        <Dock />
        <Hand />
      </div>
    </div>
  );
}
