import type { Deployment, PlayerId } from '../../game';
import { roleIcon } from '../art';
import { ROLE_LABELS } from '../labels';
import type { Board, BoardShip } from '../session/board';
import { Icon } from './Icon';

type NameOf = (id: PlayerId) => string;

interface HarborProps {
  readonly board: Board;
  readonly nameOf: NameOf;
  /** Viewer's own locked deployment, shown before the public reveal. */
  readonly myDeployment: Deployment | null;
}

/** Recruitment board before launch, then this round's ships and what happened to them. */
export function Harbor({ board, nameOf, myDeployment }: HarborProps) {
  return (
    <section className="panel harbor">
      <h2>港口</h2>
      {board.launched ? <ShipList board={board} nameOf={nameOf} myDeployment={myDeployment} /> : <Recruitment board={board} nameOf={nameOf} />}
    </section>
  );
}

function Recruitment({ board, nameOf }: { readonly board: Board; readonly nameOf: NameOf }) {
  if (board.recruiters.length === 0) {
    return <p className="muted">目前沒有合資招募。</p>;
  }
  return (
    <ul className="recruit-list">
      {board.recruiters.map((id) => {
        const applicants = board.applications.filter((a) => a.recruiterId === id).map((a) => nameOf(a.applicantId));
        const venture = board.ventures.find((v) => v.recruiterId === id || v.applicantId === id);
        return (
          <li key={id} className={board.withdrawn.includes(id) ? 'withdrawn' : ''}>
            <Icon name="handshake" size={20} /> <strong>{nameOf(id)}</strong> 發起合資招募
            {board.withdrawn.includes(id) && <span className="tag">已撤回</span>}
            {applicants.length > 0 && <span className="muted">　應徵：{applicants.join('、')}</span>}
            {venture && <span className="tag ready">合資成立</span>}
          </li>
        );
      })}
    </ul>
  );
}

function ShipList({ board, nameOf, myDeployment }: HarborProps) {
  return (
    <>
      <div className="ships">
        {board.ships.length === 0 && <p className="muted">本回合沒有船出航。</p>}
        {board.ships.map((ship) => (
          <ShipCard
            key={ship.id}
            ship={ship}
            nameOf={nameOf}
            roles={board.revealedRoles.filter((d) => d.targetShipId === ship.id)}
            mine={myDeployment?.targetShipId === ship.id && board.revealedRoles.length === 0 ? myDeployment : null}
          />
        ))}
      </div>
      {board.stayedInPort.length > 0 && <p className="muted">留港：{board.stayedInPort.map(nameOf).join('、')}</p>}
    </>
  );
}

interface ShipCardProps {
  readonly ship: BoardShip;
  readonly nameOf: NameOf;
  readonly roles: readonly Deployment[];
  readonly mine: Deployment | null;
}

function ShipCard({ ship, nameOf, roles, mine }: ShipCardProps) {
  const status = ship.outcome === 'arrived' ? 'ship-arrived' : ship.outcome === 'sank' ? 'ship-sunk' : null;
  return (
    <article className={`ship-card ${ship.outcome ?? 'sailing'}`}>
      <div className="ship-art">
        <Icon name={ship.kind === 'joint' ? 'ship-joint' : 'ship-solo'} size={48} />
        {status && <Icon name={status} size={28} />}
      </div>
      <div className="ship-info">
        <strong>{ship.owners.map(nameOf).join(' ＋ ')}</strong>
        <span className="muted">
          {ship.kind === 'joint' ? '合資船' : '獨資船'}
          {ship.outcome === 'arrived' && '・成功抵達'}
          {ship.outcome === 'sank' && '・沉沒'}
        </span>
        <div className="ship-roles">
          {roles.map((d) => (
            <span key={`${d.playerId}-${d.role}`} className={`role-chip ${d.role}`}>
              <Icon name={roleIcon(d.role)} size={16} /> {nameOf(d.playerId)}・{ROLE_LABELS[d.role]}
            </span>
          ))}
          {mine && (
            <span className={`role-chip ${mine.role} secret`}>
              <Icon name={roleIcon(mine.role)} size={16} /> 你的{ROLE_LABELS[mine.role]}（未公開）
            </span>
          )}
          {ship.rerolled && (
            <span className="role-chip">
              <Icon name="reroll" size={16} /> 已被重擲
            </span>
          )}
          {ship.smuggled > 0 && <span className="role-chip smuggler">被走私 {ship.smuggled} G</span>}
          {ship.caughtSmugglers.length > 0 && (
            <span className="role-chip guard">查獲走私：{ship.caughtSmugglers.map(nameOf).join('、')}</span>
          )}
        </div>
      </div>
    </article>
  );
}
