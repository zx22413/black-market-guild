import { useState } from 'react';
import type { DecisionContext } from '../../bots';
import { ROLE_IDS, type Action, type AssetId, type RoleId, type ShipId } from '../../game';
import { assetIcon, roleIcon } from '../art';
import { Icon } from '../components/Icon';
import { ASSET_LABELS, ROLE_LABELS } from '../labels';
import type { SceneSeat } from '../scene/tableModel';
import { assetText, roleText } from '../rulesText';
import { ConfirmChoice } from './ConfirmChoice';
import { PartnerPicker } from './PartnerPicker';
import { partnerChoice, type PartnerPick } from './partnerChoice';

export interface DecisionDockProps {
  readonly context: DecisionContext;
  readonly describeShip: (id: ShipId) => string;
  /** Role card picked during deployment; its targets are then chosen on the table. */
  readonly role: RoleId | null;
  readonly onRole: (role: RoleId | null) => void;
  /** Ship picked as the role's target, and the explicit "deploy nothing" pick; neither is sent until confirmed. */
  readonly ship: ShipId | null;
  readonly onShip: (ship: ShipId) => void;
  readonly noDeploy: boolean;
  readonly onNoDeploy: () => void;
  readonly onSubmit: (action: Action) => void;
  /** Seats as drawn on the table; their public ledgers feed the partner info card. */
  readonly seats: readonly SceneSeat[];
  /** Pending (not yet confirmed) partner selection, shared with the table's island highlight. */
  readonly partner: PartnerPick | null;
  readonly onPartner: (pick: PartnerPick | null) => void;
}

/** Bottom-of-table controls for the viewer's current decision, one layout per phase. */
export function DecisionDock({ context, describeShip, role, onRole, ship, onShip, noDeploy, onNoDeploy, onSubmit, seats, partner, onPartner }: DecisionDockProps) {
  const { view, decision } = context;
  const { rules } = view;
  const legal = <T extends Action['type']>(type: T) => context.legalActions.filter((a): a is Extract<Action, { type: T }> => a.type === type);

  switch (decision.phase) {
    case 'asset-purchase':
      return <AssetPurchase context={context} onSubmit={onSubmit} />;
    case 'recruit':
      return (
        <ConfirmChoice
          prompt="要發起合資招募嗎？（公開，不指定對象）"
          options={legal('recruit').map((action) => ({ label: action.recruit ? '發起招募' : '不發起', action }))}
          onSubmit={onSubmit}
        />
      );
    case 'apply':
    case 'pick': {
      const choice = partnerChoice(context);
      return choice ? <PartnerPicker choice={choice} note={choice.phase === 'apply' && view.recruitment.recruiters.includes(view.playerId) ? '應徵他人會撤回你的招募' : null} seats={seats} pick={partner} onPick={onPartner} onSubmit={onSubmit} /> : null;
    }
    case 'sailing-choice':
      return (
        <ConfirmChoice
          prompt={
            <>
              獨資出航或留港<small>（獨資成本 {rules.soloShip.cost} G，抵達收入 {rules.soloShip.income} G；造船廠可折抵）</small>
            </>
          }
          options={legal('choose-sailing').map((action) => ({ label: action.choice === 'solo' ? '獨資出航' : '不出航', action }))}
          onSubmit={onSubmit}
        />
      );
    case 'role-deployment':
      return <RoleDeployment context={context} describeShip={describeShip} role={role} onRole={onRole} ship={ship} onShip={onShip} noDeploy={noDeploy} onNoDeploy={onNoDeploy} onSubmit={onSubmit} />;
    case 'intel-reroll':
      return (
        <ConfirmChoice
          prompt={
            view.intel ? (
              <span className="intel">
                <Icon name="dice" size={26} /> {describeShip(view.intel.shipId)} 的原始骰值 <b>{view.intel.rawRoll}</b>
                <small>（修正前{view.intel.rawRoll >= rules.sailing.successMin ? '會抵達' : '會沉沒'}，尚未計入角色與事件）</small>
              </span>
            ) : (
              '是否重擲？'
            )
          }
          options={legal('intel-reroll').map((action) => ({ label: action.reroll ? '重擲（必須接受新結果）' : '保留原骰值', action }))}
          onSubmit={onSubmit}
        />
      );
  }
}

/** Buying an asset: tap a card to read its effect, then confirm; "don't buy" is a pick too. */
function AssetPurchase({ context, onSubmit }: Pick<DecisionDockProps, 'context' | 'onSubmit'>) {
  const [pick, setPick] = useState<AssetId | 'none' | null>(null);
  const { rules } = context.view;
  const buys = context.legalActions.filter((a) => a.type === 'buy-asset' && a.asset !== null);
  const pass = context.legalActions.find((a) => a.type === 'buy-asset' && a.asset === null);
  const pending = pick === 'none' ? pass : pick ? buys.find((a) => a.type === 'buy-asset' && a.asset === pick) : undefined;
  return (
    <>
      <div className="card-hand">
        {buys.map((a) =>
          a.type === 'buy-asset' && a.asset ? (
            <button key={a.asset} type="button" className={`table-card hand ${pick === a.asset ? 'selected' : ''}`} aria-pressed={pick === a.asset} onClick={() => setPick(pick === a.asset ? null : a.asset!)}>
              <Icon name={assetIcon(a.asset)} size={30} />
              <strong>{ASSET_LABELS[a.asset]}</strong>
              <span className="price">{rules.assets[a.asset].price} G</span>
            </button>
          ) : null,
        )}
      </div>
      <div className="action-pill">
        <span>
          {pick && pick !== 'none' ? (
            <>
              <b>{ASSET_LABELS[pick]}</b>（{rules.assets[pick].price} G）：{assetText(pick, rules)}
            </>
          ) : pick === 'none' ? (
            '本回合不購買資產，確認後才會送出'
          ) : (
            '購買資產（每回合最多一張）：點選一張卡查看效果，確認後才購買'
          )}
        </span>
        <div className="pill-row">
          {pass && (
            <button type="button" className={`partner-option ${pick === 'none' ? 'selected' : ''}`} aria-pressed={pick === 'none'} onClick={() => setPick('none')}>
              不購買
            </button>
          )}
          <button type="button" className="primary" disabled={!pending} onClick={() => pending && onSubmit(pending)}>
            {pick === 'none' ? '確認不購買' : pick ? `確認購買 ${ASSET_LABELS[pick]}` : '確認購買'}
          </button>
        </div>
      </div>
    </>
  );
}

type RoleDeploymentProps = Pick<
  DecisionDockProps,
  'context' | 'describeShip' | 'role' | 'onRole' | 'ship' | 'onShip' | 'noDeploy' | 'onNoDeploy' | 'onSubmit'
>;

function RoleDeployment({ context, describeShip, role, onRole, ship, onShip, noDeploy, onNoDeploy, onSubmit }: RoleDeploymentProps) {
  const deploys = context.legalActions.filter((a) => a.type === 'deploy-role');
  const available = new Set(deploys.map((a) => a.role));
  const none = deploys.find((a) => a.role === null);
  const targets = deploys.filter((a) => a.role !== null && a.role === role);
  const { rules } = context.view;
  const pending = noDeploy ? none : role && ship ? deploys.find((a) => a.role === role && a.targetShipId === ship) : undefined;
  return (
    <>
      <div className="card-hand">
        {ROLE_IDS.map((r) => (
          <button
            key={r}
            className={`table-card hand ${r === role ? 'selected' : ''}`}
            disabled={!available.has(r)}
            onClick={() => onRole(r === role ? null : r)}
          >
            <Icon name={roleIcon(r)} size={30} />
            <strong>{ROLE_LABELS[r]}</strong>
            <span className="price">{rules.roles[r].fee} G</span>
          </button>
        ))}
      </div>
      <div className="action-pill">
        <span>
          {role ? (
            <>
              點選海上的船作為 <b>{ROLE_LABELS[role]}</b> 的目標，確認後才會鎖定<small>（{roleText(role, rules)}）</small>
            </>
          ) : noDeploy ? (
            '本回合不部署角色，確認後才會鎖定'
          ) : (
            '秘密部署角色：選一張角色牌（鎖定後不能更改）'
          )}
        </span>
        {role && (
          <div className="pill-row">
            {targets.map((a) =>
              a.type === 'deploy-role' && a.targetShipId ? (
                <button key={a.targetShipId} type="button" className={`partner-option ${ship === a.targetShipId ? 'selected' : ''}`} aria-pressed={ship === a.targetShipId} onClick={() => onShip(a.targetShipId!)}>
                  {describeShip(a.targetShipId)}
                </button>
              ) : null,
            )}
          </div>
        )}
        <div className="pill-row">
          {none && (
            <button type="button" className={`partner-option ${noDeploy ? 'selected' : ''}`} aria-pressed={noDeploy} onClick={onNoDeploy}>
              不部署
            </button>
          )}
          <button type="button" className="primary" disabled={!pending} onClick={() => pending && onSubmit(pending)}>
            {noDeploy ? '確認不部署' : role && ship ? `確認部署 ${ROLE_LABELS[role]}` : '確認部署'}
          </button>
        </div>
      </div>
    </>
  );
}
