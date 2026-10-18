import { GOODS, capacityFor, producedFor, shipCostFor, traitOf, type GoodId, type IslandId, type PlayerId, type Rules } from '../../v07/game';
import { GOOD_LABELS } from '../labels';

// The islands that change production or costs (docs/game-design.md §11.2) at work on the table: at
// the round's start, an island whose production differs from an ordinary island's this round
// (the lumber camp's extra wood, the mine's missing wood, the spice isles' extra spice and the spice
// they kept, the smugglers' port's arms); at the launch, an island whose ship costs or holds a
// different amount (the free port, the lighthouse). Only the differences, so a pulse always means
// "this island just counted". Derived from the rules, never invented here.

export interface MomentChip {
  /** The good it is about, shown as its icon; null for money and space. */
  readonly good: GoodId | null;
  readonly text: string;
  /** Good for the island (gold) or a cost of its trait (grey). */
  readonly tone: 'gain' | 'loss';
  /** The full sentence, for the tooltip. */
  readonly title: string;
}

export interface IslandMoment {
  readonly playerId: PlayerId;
  readonly island: IslandId;
  readonly chips: readonly MomentChip[];
  /** Gold when anything in it helps the island, grey when it only costs. */
  readonly tone: 'gain' | 'loss';
}

const moment = (playerId: PlayerId, island: IslandId, chips: readonly MomentChip[]): IslandMoment[] =>
  chips.length === 0 ? [] : [{ playerId, island, chips, tone: chips.some((c) => c.tone === 'gain') ? 'gain' : 'loss' }];

/**
 * Round `round`'s start: what each island produced beyond or short of an ordinary island, and the
 * spice an island that keeps spice carried over (`carriedSpice`: its spice before this round's production).
 */
export function openingMoments(
  islands: Readonly<Record<PlayerId, IslandId>>,
  round: number,
  rules: Rules,
  carriedSpice: (id: PlayerId) => number,
): IslandMoment[] {
  const ordinary = producedFor(rules, null, round);
  return Object.entries(islands).flatMap(([playerId, island]) => {
    const made = producedFor(rules, island, round);
    const chips: MomentChip[] = GOODS.flatMap((good): MomentChip[] => {
      const diff = made[good] - ordinary[good];
      if (diff > 0) return [{ good, text: `+${diff}`, tone: 'gain', title: `${GOOD_LABELS[good]}多產 ${diff}` }];
      if (diff < 0) return [{ good, text: '沒產', tone: 'loss', title: `這回合沒產${GOOD_LABELS[good]}` }];
      return [];
    });
    const kept = carriedSpice(playerId);
    if (traitOf(rules, island).keepsSpice > 0 && kept > 0) chips.push({ good: 'spice', text: `保住 ${kept}`, tone: 'gain', title: `上回合的 ${kept} 香料沒有壞` });
    return moment(playerId, island, chips);
  });
}

/** The launch: islands whose ship cost or hold differs from an ordinary island's, for the players who launched. */
export function launchMoments(islands: Readonly<Record<PlayerId, IslandId>>, launched: readonly PlayerId[], rules: Rules): IslandMoment[] {
  const cost = shipCostFor(rules, null);
  const hold = capacityFor(rules, [], null);
  return launched.flatMap((playerId) => {
    const island = islands[playerId];
    if (!island) return [];
    const chips: MomentChip[] = [];
    const myCost = shipCostFor(rules, island);
    if (myCost !== cost) chips.push({ good: null, text: `出航 ${myCost} G`, tone: myCost < cost ? 'gain' : 'loss', title: `出航成本 ${myCost} G（一般 ${cost} G）` });
    const myHold = capacityFor(rules, [], island) - hold;
    if (myHold !== 0) chips.push({ good: null, text: `可裝 ${myHold > 0 ? '+' : '−'}${Math.abs(myHold)}`, tone: myHold > 0 ? 'gain' : 'loss', title: `可裝貨量 ${myHold > 0 ? '+' : '−'}${Math.abs(myHold)}` });
    return moment(playerId, island, chips);
  });
}
