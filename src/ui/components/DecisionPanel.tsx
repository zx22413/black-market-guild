import { useState } from 'react';
import type { DecisionContext } from '../../bots';
import { ROLE_IDS, type Action, type DecisionPhase, type PlayerId, type RoleId } from '../../game';
import { assetIcon, roleIcon, type IconKey } from '../art';
import { ASSET_LABELS, ROLE_LABELS } from '../labels';
import { assetText, roleText } from '../rulesText';
import type { Board } from '../session/board';
import { Icon } from './Icon';

type NameOf = (id: PlayerId) => string;

interface DecisionPanelProps {
  readonly context: DecisionContext;
  readonly board: Board;
  readonly nameOf: NameOf;
  readonly onSubmit: (action: Action) => void;
}

const PHASE_TITLES: Readonly<Record<DecisionPhase, string>> = {
  'asset-purchase': '購買資產',
  recruit: '發起合資招募？',
  apply: '應徵合資',
  pick: '挑選合資夥伴',
  'sailing-choice': '獨資出航或留港',
  'role-deployment': '秘密部署角色',
  'intel-reroll': '情報：是否重擲？',
};

interface Option {
  readonly action: Action;
  readonly title: string;
  readonly detail?: string;
  readonly icon?: IconKey;
}

/** Shows the legal actions of one pending decision; only offered actions can be submitted. */
export function DecisionPanel({ context, board, nameOf, onSubmit }: DecisionPanelProps) {
  const { decision, view } = context;
  return (
    <section className="panel decision">
      <h2>
        {nameOf(decision.playerId)}：{PHASE_TITLES[decision.phase]}
      </h2>
      {decision.phase === 'role-deployment' ? (
        <RoleDeployment context={context} board={board} nameOf={nameOf} onSubmit={onSubmit} />
      ) : (
        <>
          {decision.phase === 'intel-reroll' && view.intel && (
            <p className="intel-report">
              <Icon name="dice" size={28} /> 目標船（{shipOwners(board, view.intel.shipId, nameOf)}）的原始骰值：
              <strong className="die">{view.intel.rawRoll}</strong>
              <span className="muted">
                （{view.intel.rawRoll >= view.rules.sailing.successMin ? '修正前為抵達' : '修正前為沉沒'}；尚未計入角色與事件）
              </span>
            </p>
          )}
          <OptionList options={describeOptions(context, nameOf)} onSubmit={onSubmit} />
        </>
      )}
    </section>
  );
}

function OptionList({ options, onSubmit }: { readonly options: readonly Option[]; readonly onSubmit: (a: Action) => void }) {
  return (
    <div className="options">
      {options.map((o, i) => (
        <button key={i} className="option" onClick={() => onSubmit(o.action)}>
          {o.icon && <Icon name={o.icon} size={32} />}
          <span>
            <strong>{o.title}</strong>
            {o.detail && <small>{o.detail}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}

function shipOwners(board: Board, shipId: string, nameOf: NameOf): string {
  const ship = board.ships.find((s) => s.id === shipId);
  return ship ? `${ship.owners.map(nameOf).join(' ＋ ')}${ship.kind === 'joint' ? '・合資' : '・獨資'}` : shipId;
}

function describeOptions(context: DecisionContext, nameOf: NameOf): Option[] {
  const { rules, recruitment, playerId } = context.view;
  const ownRecruitment = recruitment.recruiters.includes(playerId);
  return context.legalActions.map((action): Option => {
    switch (action.type) {
      case 'buy-asset':
        return action.asset
          ? {
              action,
              icon: assetIcon(action.asset),
              title: `${ASSET_LABELS[action.asset]}（${rules.assets[action.asset].price} G）`,
              detail: assetText(action.asset, rules),
            }
          : { action, title: '不購買' };
      case 'recruit':
        return action.recruit
          ? { action, icon: 'handshake', title: '發起招募', detail: '公開招募合資夥伴，不指定對象。' }
          : { action, title: '不發起' };
      case 'apply':
        if (!action.recruiterId) {
          return { action, title: '不應徵' };
        }
        return {
          action,
          icon: 'handshake',
          title: `應徵 ${nameOf(action.recruiterId)}`,
          ...(ownRecruitment ? { detail: '應徵他人會撤回你自己的招募；若對方也應徵你，合資直接成立。' } : {}),
        };
      case 'pick':
        return action.applicantId
          ? { action, icon: 'handshake', title: `選擇 ${nameOf(action.applicantId)}` }
          : { action, title: '都不選' };
      case 'choose-sailing':
        return action.choice === 'solo'
          ? {
              action,
              icon: 'ship-solo',
              title: '獨資出航',
              detail: `成本 ${rules.soloShip.cost} G，抵達收入 ${rules.soloShip.income} G（造船廠可折抵）。`,
            }
          : { action, title: '不出航', detail: '不付航運成本，仍可部署角色。' };
      case 'intel-reroll':
        return action.reroll
          ? { action, icon: 'reroll', title: '重擲', detail: '必須接受新結果。' }
          : { action, title: '保留原骰值' };
      case 'deploy-role':
        return { action, title: action.role ? ROLE_LABELS[action.role] : '不部署' };
    }
  });
}

function RoleDeployment({ context, board, nameOf, onSubmit }: DecisionPanelProps) {
  const [role, setRole] = useState<RoleId | null>(null);
  const deploys = context.legalActions.filter((a) => a.type === 'deploy-role');
  const noRole = deploys.find((a) => a.role === null);
  const available = ROLE_IDS.filter((r) => deploys.some((a) => a.role === r));
  const targets = deploys.filter((a) => a.role !== null && a.role === role);
  const { rules } = context.view;

  return (
    <>
      <p className="muted">所有人同時秘密選擇；鎖定後不能更改。</p>
      <div className="options roles">
        {available.map((r) => (
          <button key={r} className={r === role ? 'option selected' : 'option'} onClick={() => setRole(r)}>
            <Icon name={roleIcon(r)} size={32} />
            <span>
              <strong>
                {ROLE_LABELS[r]}（{rules.roles[r].fee} G）
              </strong>
              <small>{roleText(r, rules)}</small>
            </span>
          </button>
        ))}
        {noRole && (
          <button className="option" onClick={() => onSubmit(noRole)}>
            <span>
              <strong>不部署</strong>
            </span>
          </button>
        )}
      </div>
      {role && (
        <div className="targets">
          <h3>選擇 {ROLE_LABELS[role]} 的目標船</h3>
          <div className="options">
            {targets.map((a) => (
              <button key={a.targetShipId} className="option" onClick={() => onSubmit(a)}>
                <Icon name="ship-solo" size={28} />
                <span>
                  <strong>{a.targetShipId ? shipOwners(board, a.targetShipId, nameOf) : ''}</strong>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
