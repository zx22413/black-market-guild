import type { GoodId } from '../../v07/game';
import { GOOD_LABELS } from '../labels';
import { restockText } from '../table/restock';
import { InfoTip } from './InfoTip';
import { ClockIcon } from './icons';

/** Rounds until the island next produces this good, like a role's cooldown clock; pointed at, it says which round. */
export function RestockTag({ good, next, round }: { readonly good: GoodId; readonly next: number | null; readonly round: number }) {
  return (
    <InfoTip title={`${GOOD_LABELS[good]}補貨`} text={restockText(next, round)}>
      <span className={`restock-tag good-${good} ${next === null ? 'none' : ''}`} data-restock={good}>
        <ClockIcon />
        {next === null ? '–' : next - round}
      </span>
    </InfoTip>
  );
}
