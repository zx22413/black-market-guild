import { useState } from 'react';
import { GOODS, ROLE_IDS, cooldownFor, roleFee, type Bet, type RoleId, type ShipId } from '../../v07/game';
import { GOOD_LABELS, ROLE_LABELS, ROLE_TEXT } from '../labels';
import { goodsText } from '../log';
import { legalOf, type FormProps } from './forms';

type Choice = RoleId | 'none';

/**
 * §5 step 3, §9: pick one role (or none) with its target. Roles on cooldown or beyond your cash
 * stay visible but gray, with the reason; the legal actions decide what can be confirmed.
 */
export function DeployForm({ context, nameOf, onSubmit }: FormProps) {
  const { view } = context;
  const rules = view.rules;
  const me = view.players.find((p) => p.id === view.playerId)!;
  const legal = legalOf(context, 'deploy-role');
  const [choice, setChoice] = useState<Choice | null>(null);
  const [target, setTarget] = useState<ShipId | null>(null);
  const [peek, setPeek] = useState<ShipId | null>(null);
  const [bet, setBet] = useState<Bet | null>(null);

  const role = choice === 'none' ? null : choice;
  const roleLegal = legal.filter((a) => a.role === role);
  const targets = [...new Set(roleLegal.flatMap((a) => (a.targetShipId ? [a.targetShipId] : [])))];
  const peeks = [...new Set(roleLegal.filter((a) => a.targetShipId === target).flatMap((a) => (a.peekShipId ? [a.peekShipId] : [])))];
  const shipLabel = (id: ShipId) => {
    const ship = view.ships.find((s) => s.id === id);
    if (!ship) return id;
    const mine = ship.owner === view.playerId;
    return `${nameOf(ship.owner)}的船${mine && ship.cargo ? `（你的貨：${goodsText(ship.cargo)}）` : ''}`;
  };

  const reasonUnavailable = (r: RoleId): string | null => {
    if (!view.myAvailableRoles.includes(r)) {
      const last = me.lastUsed[r] ?? 0;
      return `冷卻中，第 ${last + cooldownFor(rules, me.island, r) + 1} 回合可用`;
    }
    if (me.cash < roleFee(rules, me.island, r)) return '現金不足以支付部署費';
    if (!legal.some((a) => a.role === r)) return '沒有可選的目標';
    return null;
  };

  const pick = (next: Choice) => {
    setChoice(next);
    setTarget(null);
    setPeek(null);
    setBet(null);
  };

  const action =
    choice === 'none'
      ? legal.find((a) => a.role === null)
      : legal.find(
          (a) =>
            a.role === role &&
            a.targetShipId === (role === 'broker' ? null : target) &&
            (role === 'broker' ? a.bet?.good === bet?.good && a.bet?.direction === bet?.direction : true) &&
            a.peekShipId === peek,
        );

  return (
    <div className="v7-form">
      <p className="v7-muted">所有人同時、秘密選擇；角色在情報重擲後一次公開。可以不部署。</p>
      <div className="v7-role-grid">
        {ROLE_IDS.map((r) => {
          const why = reasonUnavailable(r);
          return (
            <button
              key={r}
              className={`v7-role-card${choice === r ? ' on' : ''}${why ? ' off' : ''}`}
              disabled={why !== null}
              aria-disabled={why !== null}
              onClick={() => pick(r)}
            >
              <strong>{ROLE_LABELS[r]}</strong>
              <span className="v7-fee">{roleFee(rules, me.island, r)} G</span>
              <span className="v7-muted">{why ?? ROLE_TEXT[r]}</span>
            </button>
          );
        })}
        <button className={`v7-role-card none${choice === 'none' ? ' on' : ''}`} onClick={() => pick('none')}>
          <strong>不部署</strong>
          <span className="v7-muted">本回合不派角色。</span>
        </button>
      </div>

      {role !== null && role !== 'broker' && (
        <>
          <h3>選目標船</h3>
          <div className="v7-choice-grid">
            {targets.map((id) => (
              <button key={id} className={`v7-choice${target === id ? ' on' : ''}`} onClick={() => { setTarget(id); setPeek(null); }}>
                {shipLabel(id)}
              </button>
            ))}
          </div>
          {role === 'intel' && target !== null && (
            <>
              <h3>
                多看一艘 <small>燈塔島特權，可不選</small>
              </h3>
              <div className="v7-choice-grid">
                <button className={`v7-choice${peek === null ? ' on' : ''}`} onClick={() => setPeek(null)}>
                  只看這一艘
                </button>
                {peeks.map((id) => (
                  <button key={id} className={`v7-choice${peek === id ? ' on' : ''}`} onClick={() => setPeek(id)}>
                    {shipLabel(id)}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {role === 'broker' && (
        <>
          <h3>押注商品與方向</h3>
          <div className="v7-bet-grid">
            {GOODS.flatMap((good) =>
              ([1, -1] as const).map((direction) => (
                <button
                  key={`${good}${direction}`}
                  className={`v7-choice${bet?.good === good && bet.direction === direction ? ' on' : ''}`}
                  onClick={() => setBet({ good, direction })}
                >
                  {GOOD_LABELS[good]}{direction === 1 ? ' 漲 ▲' : ' 跌 ▼'}
                </button>
              )),
            )}
          </div>
        </>
      )}

      <button className="v7-primary" disabled={!action} onClick={() => action && onSubmit(action)}>
        {choice === 'none' ? '提交：不部署' : choice ? `提交：${ROLE_LABELS[choice]}` : '請先選擇角色'}
      </button>
    </div>
  );
}
