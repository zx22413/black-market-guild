import type { DecisionContext } from '../../v07/bots';
import { GOODS, traitOf, type GoodId, type Goods } from '../../v07/game';
import { canLoad, stockSplit, type InvestChoice, type investOptions } from './investChoice';
import { nextProductionRound } from './restock';

// The loading step of the ship bays as plain data: one card per good in the warehouse, so every crate that can
// be loaded is a button in the bottom hand (CargoHand) and the 3D warehouse is not needed to load. A card carries
// what the stack's label and clock used to say, and nothing more: how many are left, how many are aboard, a clock
// only when the island does not make more next round, a warning for spice that would spoil.

export interface CargoCard {
  readonly good: GoodId;
  /** Units still in the warehouse (after what is aboard). */
  readonly left: number;
  /** Units of this good aboard. */
  readonly loaded: number;
  readonly loadable: boolean;
  /** Why the card is greyed; null when a crate can be loaded. */
  readonly reason: string | null;
  /** Rounds until the island makes more of it, only when that is not the next round (0 = never again); null when it is the next round. */
  readonly restock: number | null;
  /** Spice left in the warehouse spoils at the end of the round (§6.3). */
  readonly spoils: boolean;
  /** Units this round's production just added, while that is being shown. */
  readonly made: number;
}

export function cargoCards(
  context: DecisionContext,
  options: ReturnType<typeof investOptions>,
  choice: InvestChoice,
  round: number,
  made: Goods | null,
): CargoCard[] {
  const { view } = context;
  const me = view.players.find((p) => p.id === view.playerId)!;
  const { left } = stockSplit(context, choice);
  const keepsSpice = traitOf(view.rules, me.island).keepsSpice === 1;
  return GOODS.map((good): CargoCard => {
    const loadable = canLoad(options, choice, good);
    const next = nextProductionRound(view.rules, me.island, good, round);
    const reason = loadable ? null : left[good] <= 0 ? '倉庫沒有了' : choice.shipType == null ? '先選一艘船' : '船裝滿了';
    return {
      good,
      left: left[good],
      loaded: choice.load[good],
      loadable,
      reason,
      // The default (every good every round) needs no clock; only a different wait does.
      restock: next === null ? 0 : next - round === 1 ? null : next - round,
      spoils: good === 'spice' && !keepsSpice && left[good] > 0,
      made: made === null ? 0 : made[good],
    };
  });
}
