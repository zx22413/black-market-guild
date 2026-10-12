import { ROLE_IDS, type Deployment, type Goods, type PlayerId, type ShipId } from '../../v07/game';
import { GOOD_LABELS, ROLE_LABELS } from '../labels';
import type { Board, BoardShip } from '../session/board';
import { GoodsList } from './parts';

interface ShipsPanelProps {
  readonly board: Board;
  readonly nameOf: (id: PlayerId) => string;
  /** My own cargo (private, §4); empty when no private view is on screen. */
  readonly myCargo: Readonly<Record<ShipId, Goods>>;
  readonly viewerId: PlayerId | null;
}

const fmt = (n: number): string => (n > 0 ? `+${n}` : String(n));

function Modifier({ ship }: { readonly ship: BoardShip }) {
  const m = ship.modifier;
  if (!m) return null;
  return (
    <div className="v7-mod" title="起始骰值與各步驟修正（§9.1）">
      骰 {m.base}
      {m.guard !== 0 && ` 護衛${fmt(m.guard)}`}
      {m.pirate !== 0 && ` 海盜${fmt(m.pirate)}`}
      {m.event !== 0 && ` 事件${fmt(m.event)}`}
      {m.island !== 0 && ` 島${fmt(m.island)}`} → <b>{m.final}</b>
    </div>
  );
}

function deploymentsOn(board: Board, shipId: ShipId): Deployment[] {
  return ROLE_IDS.flatMap((role) => board.revealedRoles.filter((d) => d.role === role && d.targetShipId === shipId));
}

/** This round's ships (§4: owner public, cargo hidden until resolved) and the roles revealed on them. */
export function ShipsPanel({ board, nameOf, myCargo, viewerId }: ShipsPanelProps) {
  const brokers = board.revealedRoles.filter((d) => d.role === 'broker');
  const peeks = board.revealedRoles.filter((d) => d.role === 'intel' && d.peekShipId !== null);
  if (!board.launched) {
    return <p className="v7-muted">本回合還沒有出航的船。</p>;
  }
  if (board.ships.length === 0) {
    return <p className="v7-muted">本回合沒有人出航。</p>;
  }
  return (
    <div className="v7-ships">
      {board.ships.map((ship) => {
        const roles = deploymentsOn(board, ship.id);
        const cargo = ship.cargo ?? myCargo[ship.id] ?? null;
        return (
          <article key={ship.id} className={`v7-ship ${ship.outcome ?? ''}`}>
            <header>
              <strong>{nameOf(ship.owner)}的船{ship.owner === viewerId && <em>（你）</em>}</strong>
              {ship.outcome && <span className={`v7-outcome ${ship.outcome}`}>{ship.outcome === 'arrived' ? '抵達' : '沉沒'}</span>}
              {ship.rerolled && <span className="v7-badge">被重擲</span>}
            </header>
            <div className="v7-ship-cargo">
              <span className="v7-muted">{ship.cargo ? '貨物' : cargo ? '你的貨' : '貨物'}</span>{' '}
              {cargo ? <GoodsList goods={cargo} /> : <span className="v7-muted">保密到結算</span>}
              {ship.confiscatedArms > 0 && <span className="v7-note">（{ship.confiscatedArms} 軍火被沒收）</span>}
            </div>
            {roles.length > 0 && (
              <div className="v7-ship-roles">
                {roles.map((d) => (
                  <span key={`${d.role}-${d.playerId}`} className={`v7-role r-${d.role}`}>
                    {ROLE_LABELS[d.role]}・{nameOf(d.playerId)}
                  </span>
                ))}
              </div>
            )}
            {ship.smuggling && <div className="v7-note">走私：{{ taken: '成功抽成', caught: '被護衛抓到', seized: '被海盜搶走', lost: '隨船沉沒' }[ship.smuggling]}</div>}
            <Modifier ship={ship} />
          </article>
        );
      })}
      {brokers.length > 0 && (
        <div className="v7-brokers">
          {brokers.map((d) => (
            <span key={d.playerId} className="v7-role r-broker">
              莊家・{nameOf(d.playerId)}押 {d.bet ? GOOD_LABELS[d.bet.good] : ''}
              {d.bet?.direction === 1 ? '漲' : '跌'}
            </span>
          ))}
        </div>
      )}
      {/* The lighthouse intel merchant's second look is public but kept understated. */}
      {peeks.length > 0 && (
        <p className="v7-peek">
          {peeks.map((d) => `${nameOf(d.playerId)}也看了${nameOf(board.ships.find((s) => s.id === d.peekShipId)?.owner ?? '')}的船`).join('；')}
        </p>
      )}
    </div>
  );
}

