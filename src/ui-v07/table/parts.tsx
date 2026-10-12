import type { ReactNode } from 'react';
import { GOODS, type GoodId, type Goods, type ShipId } from '../../v07/game';
import { GOOD_LABELS } from '../labels';

/** A good with a colored dot and an optional count. */
export function GoodTag({ good, count }: { readonly good: GoodId; readonly count?: number }) {
  return (
    <span className={`v7-good g-${good}`}>
      <i aria-hidden />
      {GOOD_LABELS[good]}
      {count !== undefined && <b>×{count}</b>}
    </span>
  );
}

/** All goods of a bundle that are above zero; a dash when empty. */
export function GoodsList({ goods, hideZero = true }: { readonly goods: Goods; readonly hideZero?: boolean }) {
  const shown = GOODS.filter((g) => !hideZero || goods[g] > 0);
  if (shown.length === 0) return <span className="v7-muted">—</span>;
  return (
    <span className="v7-goods">
      {shown.map((g) => (
        <GoodTag key={g} good={g} count={goods[g]} />
      ))}
    </span>
  );
}

export function Card({ title, aside, children, className = '' }: { readonly title: string; readonly aside?: ReactNode; readonly children: ReactNode; readonly className?: string }) {
  return (
    <section className={`v7-card ${className}`}>
      <header>
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export const shipKey = (id: ShipId): string => id;
