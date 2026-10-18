import type { Bet, RoleId } from '../../v07/game';
import { ROLE_LABELS } from '../labels';
import { betLabel, type RolePick } from '../table/deployChoice';
import { GoodIcon } from './GoodIcon';
import { ArrowIcon, IconDisc, TrendIcon } from './icons';
import { roleIconUrl } from './RoleBadges';

// What is being sent where, as two chips with an arrow between: [role] ▸ [whose ship]. A slot not
// chosen yet is a dashed empty chip, so the bar shows what is still missing without a sentence.

export interface DeployChipsProps {
  readonly role: RolePick;
  /** Broker only: the chosen bet, e.g. 「木材漲」. */
  readonly bet: Bet | null;
  /** The role goes to a ship (a broker only once it can aim at one). */
  readonly needsShip: boolean;
  readonly target: { readonly name: string; readonly color: string } | null;
}

const EMPTY = (
  <span className="chip empty" title="尚未選擇">
    ＋
  </span>
);

export function DeployChips({ role, bet, needsShip, target }: DeployChipsProps) {
  if (role === null) return <span className="chip muted">選一個角色</span>;
  if (role === 'none') return <span className="chip">不部署</span>;
  return (
    <>
      <span className="chip">
        <IconDisc src={roleIconUrl(role as RoleId)} badge />
        {ROLE_LABELS[role]}
      </span>
      {role === 'broker' &&
        (bet ? (
          <span className="chip" title={betLabel(bet)}>
            <GoodIcon good={bet.good} />
            <TrendIcon dir={bet.direction} />
          </span>
        ) : (
          EMPTY
        ))}
      {needsShip && (
        <>
          <ArrowIcon />
          {target ? (
            <span className="chip">
              <i className="seat-dot" style={{ background: target.color }} />
              {target.name}
            </span>
          ) : (
            EMPTY
          )}
        </>
      )}
    </>
  );
}
