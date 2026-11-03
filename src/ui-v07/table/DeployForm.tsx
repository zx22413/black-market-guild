import { useState } from 'react';
import { GOODS, ROLE_IDS, cooldownFor, roleFee, type GoodId, type RoleId, type ShipId } from '../../v07/game';
import { GOOD_LABELS, ROLE_LABELS, ROLE_TEXT } from '../labels';
import { goodsText } from '../log';
import { ALL_GUESSES } from './deployChoice';
import { legalOf, type FormProps } from './forms';

type Choice = RoleId | 'none';

/**
 * §5 step 3, §9: pick one role (or none) with its target. Roles on cooldown or beyond your cash
 * stay visible but gray, with the reason; the legal actions decide what can be confirmed. Customs
 * also names a good, a diplomat also guesses a role.
 */
export function DeployForm({ context, nameOf, onSubmit }: FormProps) {
  const { view } = context;
  const rules = view.rules;
  const me = view.players.find((p) => p.id === view.playerId)!;
  const legal = legalOf(context, 'deploy-role');
  const [choice, setChoice] = useState<Choice | null>(null);
  const [target, setTarget] = useState<ShipId | null>(null);
  const [good, setGood] = useState<GoodId | null>(null);
  const [guess, setGuess] = useState<RoleId | null>(null);

  const role = choice === 'none' ? null : choice;
  const roleLegal = legal.filter((a) => a.role === role);
  const targets = [...new Set(roleLegal.flatMap((a) => (a.targetShipId ? [a.targetShipId] : [])))];
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
    setGood(null);
    setGuess(null);
  };

  const action =
    choice === 'none'
      ? legal.find((a) => a.role === null)
      : legal.find(
          (a) =>
            a.role === role &&
            a.targetShipId === target &&
            a.namedGood === (role === 'customs' ? good : null) &&
            (a.guessRole ?? null) === (role === 'diplomat' ? guess : null),
        );

  return (
    <div className="v7-form">
      <p className="v7-muted">所有人同時、秘密選擇；角色在大家都決定後一次公開。可以不部署。</p>
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

      {role !== null && (
        <>
          <h3>選目標船</h3>
          <div className="v7-choice-grid">
            {targets.map((id) => (
              <button
                key={id}
                className={`v7-choice${target === id ? ' on' : ''}`}
                onClick={() => {
                  setTarget(id);
                  setGood(null);
                  setGuess(null);
                }}
              >
                {shipLabel(id)}
              </button>
            ))}
          </div>
        </>
      )}

      {role === 'customs' && target !== null && (
        <>
          <h3>指名一種貨</h3>
          <div className="v7-choice-grid">
            {GOODS.map((g) => (
              <button key={g} className={`v7-choice${good === g ? ' on' : ''}`} onClick={() => setGood(g)}>
                {GOOD_LABELS[g]}
              </button>
            ))}
          </div>
        </>
      )}

      {role === 'diplomat' && target !== null && (
        <>
          <h3>猜哪個角色會針對你的船</h3>
          <div className="v7-choice-grid">
            {ALL_GUESSES.map((r) => (
              <button key={r} className={`v7-choice${guess === r ? ' on' : ''}`} onClick={() => setGuess(r)}>
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </>
      )}

      <button className="v7-primary" disabled={!action} onClick={() => action && onSubmit(action)}>
        {choice === 'none' ? '提交：不部署' : choice ? `提交：${ROLE_LABELS[choice]}` : '請先選擇角色'}
      </button>
    </div>
  );
}
