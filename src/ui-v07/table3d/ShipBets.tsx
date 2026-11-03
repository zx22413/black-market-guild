import { useLayoutEffect, useRef, useState } from 'react';
import { GOODS, GUESSABLE_ROLES, type GoodId, type PlayerId, type RoleId } from '../../v07/game';
import { GOOD_LABELS, ROLE_LABELS } from '../labels';
import { GoodIcon } from './GoodIcon';

// What customs names or a diplomat guesses, where the ship was clicked (§9.4): once the ship is picked,
// its "+" turns into the role's badge (click it to take the pick back) and the choices are listed right
// above it: the four goods for customs, the four roles for a diplomat. The list opens
// toward the middle of the table (up for the ship in front of you), so it stays off the name plates
// that sit beside each island.

type Side = 'up' | 'down' | 'left' | 'right';

/** The list is four rows tall; a badge nearer the screen's top than this has no room above it (the market strip sits there). */
const ROOM_ABOVE = 260;

/** Which way the list opens for a badge at (`x`, `y`): sideways toward the screen's middle, up when it is near it, down when up would run under the market strip. */
export function listSide(x: number, width: number, y = Infinity): Side {
  const dx = x - width / 2;
  if (Math.abs(dx) >= width * 0.1) return dx < 0 ? 'right' : 'left';
  return y < ROOM_ABOVE ? 'down' : 'up';
}

export type NamingProps =
  | { readonly kind: 'good'; readonly offered: readonly GoodId[]; readonly chosen: GoodId | null; readonly aboard?: ReadonlySet<GoodId> | undefined; readonly onPick: (good: GoodId) => void }
  | { readonly kind: 'guess'; readonly offered: readonly RoleId[]; readonly chosen: RoleId | null; readonly aboard?: undefined; readonly onPick: (role: RoleId) => void };

export type ShipBetsProps = NamingProps & {
  readonly label: string;
  readonly owner: PlayerId;
  readonly rim: string;
  /** The role's badge picture. */
  readonly badge: string;
  /** Still to choose: the buttons breathe gold. */
  readonly todo: boolean;
  readonly onBack: () => void;
};

export function ShipBets(props: ShipBetsProps) {
  const { label, owner, rim, badge, todo, onBack } = props;
  const badgeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<Side>('up');
  useLayoutEffect(() => {
    const measure = () => {
      const box = badgeRef.current?.getBoundingClientRect();
      if (box) setOpen(listSide(box.left + box.width / 2, window.innerWidth, box.top));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return (
    <div className="dep-bets" data-open={open}>
      <ul>
        {props.kind === 'good'
          ? GOODS.map((good) => {
              const can = props.offered.includes(good);
              const on = props.chosen === good;
              return (
                <li key={good}>
                  <button
                    type="button"
                    className={`dep-bet good-${good} ${on ? 'on' : ''} ${todo && can ? 'todo' : ''} ${props.aboard?.has(good) ? 'aboard' : ''}`}
                    {...(props.aboard?.has(good) ? { title: '你的船上有這個貨' } : {})}
                    disabled={!can}
                    data-bet={good}
                    data-done={on}
                    aria-label={`指名${GOOD_LABELS[good]}`}
                    onClick={() => props.onPick(good)}
                  >
                    <GoodIcon good={good} size="sm" /> {GOOD_LABELS[good]}
                  </button>
                </li>
              );
            })
          : GUESSABLE_ROLES.map((role) => {
              const can = props.offered.includes(role);
              const on = props.chosen === role;
              return (
                <li key={role}>
                  <button
                    type="button"
                    className={`dep-bet ${on ? 'on' : ''} ${todo && can ? 'todo' : ''}`}
                    disabled={!can}
                    data-bet={role}
                    data-done={on}
                    aria-label={`猜${ROLE_LABELS[role]}`}
                    onClick={() => props.onPick(role)}
                  >
                    猜{ROLE_LABELS[role]}
                  </button>
                </li>
              );
            })}
      </ul>
      <button
        ref={badgeRef}
        type="button"
        className="dep-ship on"
        style={{ borderColor: rim }}
        data-label={`${label}・點一下取消`}
        aria-label={`取消派到${label}`}
        data-focus={`island-${owner}`}
        data-target={owner}
        data-done={true}
        onClick={onBack}
      >
        <img src={badge} alt="" />
      </button>
    </div>
  );
}
