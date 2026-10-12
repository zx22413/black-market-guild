import { ROLE_IDS, RULES_V07, cooldownFor, type PlayerId, type Rules } from '../../v07/game';
import { BUILDING_LABELS, ISLAND_LABELS, ISLAND_TEXT, ROLE_LABELS } from '../labels';
import type { Board, BoardPlayer } from '../session/board';
import { GoodsList } from './parts';

interface PlayersPanelProps {
  readonly board: Board;
  readonly order: readonly PlayerId[];
  readonly nameOf: (id: PlayerId) => string;
  readonly viewerId: PlayerId | null;
  /** Seats the table is still waiting for in the current phase (public, §4). */
  readonly waiting: readonly PlayerId[];
  readonly rules?: Rules;
}

/** §9.3: a role used in round r is unavailable until round r + cooldown + 1. */
function coolingRoles(board: Board, player: BoardPlayer, rules: Rules) {
  return ROLE_IDS.filter((role) => {
    const last = player.lastUsed[role];
    return last !== undefined && board.round - last <= cooldownFor(rules, player.island, role);
  });
}

/** Everyone's public state: island, cash, buildings, warehouse after production (§4) and cooling roles. */
export function PlayersPanel({ board, order, nameOf, viewerId, waiting, rules = RULES_V07 }: PlayersPanelProps) {
  return (
    <ul className="v7-players">
      {order.map((id) => {
        const player = board.players[id];
        if (!player) return null;
        const cooling = coolingRoles(board, player, rules);
        const island = player.island;
        return (
          <li key={id} className={id === viewerId ? 'me' : ''}>
            <div className="v7-player-head">
              <strong>
                {nameOf(id)}
                {id === viewerId && <em>（你）</em>}
              </strong>
              {board.wanted.includes(id) && <span className="v7-badge wanted" title="現金最多：被通緝（§9.6）">通緝</span>}
              {waiting.includes(id) && <span className="v7-badge wait">決定中</span>}
              <b className="v7-cash">{player.cash} G</b>
            </div>
            <div className="v7-player-meta">
              {island && (
                <span className="v7-island" title={`優點：${ISLAND_TEXT[island].pro}\n缺點：${ISLAND_TEXT[island].con}`}>
                  {ISLAND_LABELS[island]}
                </span>
              )}
              {player.buildings.map((b) => (
                <span key={b} className="v7-building">
                  {BUILDING_LABELS[b]}
                </span>
              ))}
            </div>
            <div className="v7-player-stock">
              <span className="v7-muted">倉庫</span> <GoodsList goods={player.stock} />
            </div>
            {cooling.length > 0 && (
              <div className="v7-cooling" title="冷卻中的角色（§9.3）">
                {cooling.map((role) => (
                  <span key={role}>{ROLE_LABELS[role]}</span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
