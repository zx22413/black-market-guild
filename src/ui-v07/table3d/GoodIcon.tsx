import type { ReactNode } from 'react';
import { GOODS, RULES_V07, type GoodId } from '../../v07/game';
import { GOOD_LABELS } from '../labels';
import { goodDetail } from '../table/goodText';
import { tokenIconUrl } from './icons';
import { InfoTip } from './InfoTip';

// Goods are shown as icons everywhere on the table except the price boards (market strip and the
// market settlement card, which pair the icon with the name). The icon is drawn in colour on a light
// disc ringed in the goods' color; the name is its screen-reader label, and hovering or tapping it
// explains the good.

export const goodIconUrl = (good: GoodId): string => tokenIconUrl(`good-${good}`);

/**
 * A good's icon. Hover or tap it to see what the good is for and how it behaves (`goodDetail`);
 * `tip={false}` where the same text is already beside it (the rules panel).
 */
export function GoodIcon({ good, size = 'md', tip = true }: { readonly good: GoodId; readonly size?: 'sm' | 'md' | 'lg'; readonly tip?: boolean }) {
  const icon = (
    <span className={`good-ic good-${good} ${size}`} role="img" aria-label={GOOD_LABELS[good]}>
      <img src={goodIconUrl(good)} alt="" />
    </span>
  );
  return tip ? (
    <InfoTip title={GOOD_LABELS[good]} text={goodDetail(good, RULES_V07)}>
      {icon}
    </InfoTip>
  ) : (
    icon
  );
}

/** An icon and a count: 「[icon] 2」. */
export function GoodCount({ good, count, size }: { readonly good: GoodId; readonly count: number; readonly size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className="good-count">
      <GoodIcon good={good} {...(size ? { size } : {})} />
      {count}
    </span>
  );
}

/** Goods in a warehouse as icons with their counts. */
export function GoodChips({ goods }: { readonly goods: readonly { readonly good: GoodId; readonly count: number }[] }) {
  return (
    <>
      {goods.map(({ good, count }) => (
        <GoodCount key={good} good={good} count={count} size="sm" />
      ))}
    </>
  );
}

const NAME_TO_GOOD = new Map(GOODS.map((g) => [GOOD_LABELS[g], g] as const));
const NAMES = new RegExp(`(${GOODS.map((g) => GOOD_LABELS[g]).join('|')})`);

/** A sentence with each goods' name swapped for its icon (notes beside the warehouse and ship). */
export function withGoodIcons(text: string): ReactNode[] {
  return text.split(NAMES).map((part, i) => {
    const good = NAME_TO_GOOD.get(part);
    return good ? <GoodIcon key={i} good={good} size="sm" /> : part;
  });
}
