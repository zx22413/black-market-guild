import { GOODS, type GoodId, type Goods, type MatchEvent, type PlayerId, type ShipId, type VoyageEventId } from '../../v07/game';
import type { AwningState, MarketDelivery, MarketShow } from '../../ui/scene/MarketIsland';
import { GOOD_COLORS } from './CrateModel';

// What the market island shows (docs/ui/v07-event-presentation.md §1.10), read from the public events
// the table has played so far: open for trade between a round's start and its end, awnings half in
// against a storm, lanterns lit through a moonless night, crowds and bunting in a black market rush,
// porters carrying the cargo of every ship that has arrived, and the board at the prices on show.
// Pure, so the mapping is testable.

export interface ArrivedShip {
  readonly shipId: ShipId;
  readonly owner: PlayerId;
  /** The owner's seat angle, where its berth is. */
  readonly angle: number;
}

export interface MarketShowInput {
  /** The public events played so far (the table's cutoff), in order. */
  readonly events: readonly MatchEvent[];
  /** The prices on show: the market card's while it is up, the board's otherwise. */
  readonly prices: Goods;
  readonly weather: VoyageEventId | null;
  /** Ships the table shows at the market right now. */
  readonly arrived: readonly ArrivedShip[];
}

/** Crate colors for a cargo, one per unit, goods in the table's order. */
export function cargoCrates(cargo: Readonly<Record<GoodId, number>>): string[] {
  return GOODS.flatMap((g) => Array.from({ length: cargo[g] }, () => GOOD_COLORS[g]));
}

function awningsOf(events: readonly MatchEvent[], weather: VoyageEventId | null): AwningState {
  const last = [...events].reverse().find((e) => e.type === 'round-started' || e.type === 'round-ended' || e.type === 'match-ended');
  // Before the first round the market is already open: the table should look alive from the start.
  if (last && last.type !== 'round-started') return 'shut';
  return weather === 'storm' ? 'reefed' : 'open';
}

export function marketShow({ events, prices, weather, arrived }: MarketShowInput): MarketShow {
  const round = [...events].reverse().find((e) => e.type === 'round-started');
  const roundNo = round?.type === 'round-started' ? round.round : 0;
  const deliveries = arrived.flatMap((ship): MarketDelivery[] => {
    // Cargo is public once the ship is resolved (§4); until then there is nothing to carry.
    const resolved = events.find((e) => e.type === 'ship-resolved' && e.shipId === ship.shipId && e.round === roundNo);
    if (resolved?.type !== 'ship-resolved' || resolved.outcome !== 'arrived') return [];
    const crates = cargoCrates(resolved.cargo);
    return crates.length > 0 ? [{ key: `${roundNo}-${ship.shipId}`, angle: ship.angle, crates }] : [];
  });
  const cells = GOODS.map((g) => prices[g]);
  return {
    prices: cells,
    rowColors: GOODS.map((g) => GOOD_COLORS[g]),
    awnings: awningsOf(events, weather),
    lanterns: weather === 'moonless-night' ? 'night' : weather === 'black-market-rush' ? 'festive' : 'off',
    deliveries,
    // A stroke at each round's start and whenever a price on the board moves.
    bellKey: `${roundNo}:${cells.join(',')}`,
    rush: weather === 'black-market-rush',
  };
}
