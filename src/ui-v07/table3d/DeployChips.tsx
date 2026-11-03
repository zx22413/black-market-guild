import { GOODS, type GoodId, type Goods, type RoleId } from '../../v07/game';
import { GOOD_LABELS, ROLE_LABELS } from '../labels';
import { type RolePick } from '../table/deployChoice';
import { GoodCount, GoodIcon } from './GoodIcon';
import { ArrowIcon, IconDisc, tokenIconUrl } from './icons';
import { roleIconUrl } from './RoleBadges';

// What is being sent where, as two chips with an arrow between: [role] ▸ [whose ship]. A slot not
// chosen yet is a dashed empty chip, so the bar shows what is still missing without a sentence.

export interface DeployChipsProps {
  readonly role: RolePick;
  /** Customs only: the good named. */
  readonly good: GoodId | null;
  /** Diplomat only: the role guessed. */
  readonly guess: RoleId | null;
  /** The role goes to a ship. */
  readonly needsShip: boolean;
  readonly target: { readonly name: string; readonly color: string } | null;
}

const EMPTY = (
  <span className="chip empty" title="尚未選擇">
    ＋
  </span>
);

export function DeployChips({ role, good, guess, needsShip, target }: DeployChipsProps) {
  if (role === null) return <span className="chip muted">選一個角色</span>;
  if (role === 'none') return <span className="chip">不部署</span>;
  return (
    <>
      <span className="chip">
        <IconDisc src={roleIconUrl(role as RoleId)} badge />
        {ROLE_LABELS[role]}
      </span>
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
      {role === 'customs' &&
        (good ? (
          <span className="chip" title={`指名${GOOD_LABELS[good]}`}>
            <GoodIcon good={good} />
          </span>
        ) : (
          EMPTY
        ))}
      {role === 'diplomat' &&
        (guess ? (
          <span className="chip" title={`猜${ROLE_LABELS[guess]}`}>
            猜{ROLE_LABELS[guess]}
          </span>
        ) : (
          EMPTY
        ))}
    </>
  );
}

/** What your own ship carries, so a smuggler or customs player remembers what is aboard. */
export function CargoChip({ cargo }: { readonly cargo: Goods }) {
  const aboard = GOODS.filter((g) => cargo[g] > 0);
  return (
    <span className="chip cargo" title="你的船上裝的貨">
      <IconDisc src={tokenIconUrl('ship')} />
      {aboard.length === 0 ? (
        '空船'
      ) : (
        <>
          {aboard.map((g) => (
            <GoodCount key={g} good={g} count={cargo[g]} size="sm" />
          ))}
        </>
      )}
    </span>
  );
}
