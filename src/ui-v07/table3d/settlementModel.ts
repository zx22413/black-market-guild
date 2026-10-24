import type { BuildingId, CashReason, GoodId, Goods, MatchEvent, PlayerId, ShipId } from '../../v07/game';
import { GOODS } from '../../v07/game';
import { CASH_REASON_LABELS, GOOD_LABELS } from '../labels';

// The round's settlement (docs/ui/v07-event-presentation.md §1.8) as "flights": every payment or
// good moves from where it comes from to where it goes, one at a time, grouped by ship (the
// rules' order in §5 step 8 is "mainly for presentation", so grouping changes nothing). Built from
// public events only.

export type Place =
  | { readonly kind: 'ship'; readonly shipId: ShipId }
  | { readonly kind: 'harbor' }
  | { readonly kind: 'island'; readonly playerId: PlayerId }
  | { readonly kind: 'building'; readonly playerId: PlayerId; readonly building: BuildingId };

export interface Flight {
  readonly key: string;
  /** What moves it: the cash reason, or insured, salvaged or spoiled goods (its sound). */
  readonly kind: CashReason | 'kept' | 'salvage' | 'spoil';
  readonly from: Place;
  readonly to: Place;
  /** Who gains (or, for a fine, loses) the money or goods. */
  readonly playerId: PlayerId;
  /** G moved; negative for a fine. Null for goods only. */
  readonly amount: number | null;
  readonly good: GoodId | null;
  readonly units: number;
  readonly label: string;
  /** Ship it belongs to, for grouping; null for the commission, broker bets and spoiled spice. */
  readonly shipId: ShipId | null;
  /** A building that does the work glows meanwhile (insurance, salvage, exchange). */
  readonly building: BuildingId | null;
}

const ship = (shipId: ShipId): Place => ({ kind: 'ship', shipId });
const island = (playerId: PlayerId): Place => ({ kind: 'island', playerId });
const building = (playerId: PlayerId, b: BuildingId): Place => ({ kind: 'building', playerId, building: b });
const HARBOR: Place = { kind: 'harbor' };

function cashFlight(e: Extract<MatchEvent, { type: 'cash-changed' }>, i: number): Flight | null {
  const base = { key: `cash-${i}`, kind: e.reason, playerId: e.playerId, amount: e.amount, good: null, units: 0, label: CASH_REASON_LABELS[e.reason], shipId: e.shipId, building: null };
  const fromShip = e.shipId ? ship(e.shipId) : HARBOR;
  const routes: Partial<Record<CashReason, { from: Place; to: Place; good?: GoodId; building?: BuildingId }>> = {
    sale: { from: HARBOR, to: island(e.playerId) },
    smuggling: { from: fromShip, to: island(e.playerId) },
    'smuggling-fine': { from: island(e.playerId), to: HARBOR },
    'smuggling-confiscated': { from: fromShip, to: island(e.playerId) },
    'smuggling-seized': { from: fromShip, to: island(e.playerId) },
    'arms-confiscated': { from: fromShip, to: island(e.playerId), good: 'arms' },
    'pirate-loot': { from: fromShip, to: island(e.playerId) },
    'escort-fee': { from: HARBOR, to: island(e.playerId) },
    'exchange-commission': { from: HARBOR, to: building(e.playerId, 'exchange'), building: 'exchange' },
    'broker-bet': { from: HARBOR, to: island(e.playerId) },
    'broker-control': { from: fromShip, to: island(e.playerId) },
    'broker-lift': { from: HARBOR, to: island(e.playerId) },
  };
  const route = routes[e.reason];
  if (!route) return null;
  return { ...base, from: route.from, to: route.to, good: route.good ?? null, units: route.good ? 1 : 0, building: route.building ?? null };
}

function goodsOf(goods: Goods): { good: GoodId; units: number }[] {
  return GOODS.filter((g) => goods[g] > 0).map((g) => ({ good: g, units: goods[g] }));
}

/** Flights of `round`, in display order: ship by ship (resolution order), then the rest. */
export function settlementFlights(events: readonly MatchEvent[], round: number): Flight[] {
  const start = events.findIndex((e) => e.type === 'market-settled' && e.round === round);
  if (start < 0) return [];
  const flights: Flight[] = [];
  events.forEach((e, i) => {
    if (i <= start || !('round' in e) || e.round !== round) return;
    if (e.type === 'cash-changed') {
      const f = cashFlight(e, i);
      if (f) flights.push(f);
    } else if (e.type === 'goods-kept') {
      for (const { good, units } of goodsOf(e.goods)) {
        flights.push({ key: `kept-${i}-${good}`, kind: 'kept', from: ship(e.shipId), to: building(e.playerId, 'insurance'), playerId: e.playerId, amount: null, good, units, label: `保險保住 ${units} ${GOOD_LABELS[good]}`, shipId: e.shipId, building: 'insurance' });
      }
    } else if (e.type === 'goods-salvaged') {
      flights.push({ key: `salvage-${i}`, kind: 'salvage', from: ship(e.shipId), to: building(e.playerId, 'salvage'), playerId: e.playerId, amount: null, good: e.good, units: 1, label: `打撈 +1 ${GOOD_LABELS[e.good]}`, shipId: e.shipId, building: 'salvage' });
    } else if (e.type === 'spice-spoiled') {
      for (const [playerId, units] of Object.entries(e.spoiled)) {
        if (units > 0) flights.push({ key: `spoil-${i}-${playerId}`, kind: 'spoil', from: island(playerId), to: island(playerId), playerId, amount: null, good: 'spice', units, label: `香料壞掉 ${units}`, shipId: null, building: null });
      }
    }
  });
  const order = events.flatMap((e) => (e.type === 'ship-resolved' && e.round === round ? [e.shipId] : []));
  const rank = (f: Flight) => (f.shipId === null ? order.length + (f.key.startsWith('spoil-') ? 1 : 0) : order.indexOf(f.shipId));
  // Stable sort: within a ship (and among the rest) the rules' order is kept.
  return flights.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i).map(({ f }) => f);
}

/** Cash each player has gained or lost from the first `shown` flights, for the name plates. */
export function cashSoFar(flights: readonly Flight[], shown: number): Readonly<Record<PlayerId, number>> {
  const sums: Record<PlayerId, number> = {};
  for (const f of flights.slice(0, shown)) if (f.amount !== null) sums[f.playerId] = (sums[f.playerId] ?? 0) + f.amount;
  return sums;
}

export interface MarketRow {
  readonly good: GoodId;
  readonly demand: number;
  /** Change the brokers' bets made to the demand card (§9.4). */
  readonly brokerShift: number;
  readonly arrived: number;
  readonly before: number;
  readonly after: number;
}

/** The market settlement row by row (§7.3); `cardDemand` is the demand card as revealed. */
export function marketRows(events: readonly MatchEvent[], round: number, cardDemand: Goods): MarketRow[] {
  const e = events.find((x): x is Extract<MatchEvent, { type: 'market-settled' }> => x.type === 'market-settled' && x.round === round);
  if (!e) return [];
  return GOODS.map((good) => ({
    good,
    demand: e.demand[good],
    brokerShift: e.demand[good] - cardDemand[good],
    arrived: e.arrived[good],
    before: e.priceBefore[good],
    after: e.priceAfter[good],
  }));
}
