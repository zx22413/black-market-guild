import type { BuildingId, CashReason, GoodId, Goods, MatchEvent, PlayerId, ShipId } from '../../v07/game';
import { SETTLED_EFFECTS, WORK_BEFORE, facilityReactions, workGoods, type FacilityReaction } from './facilityShow';
import { GOODS } from '../../v07/game';
import { CASH_REASON_LABELS, GOOD_LABELS } from '../labels';
import { inspectedCrates, inspectionLabel, inspections } from './inspectionShow';

// The round's settlement (docs/ui/v07-event-presentation.md §1.8) as "flights": every payment or
// good moves from where it comes from to where it goes, one at a time, grouped by ship (the
// rules' order in §5 step 8 is "mainly for presentation", so grouping changes nothing). Built from
// public events only.

export type Place =
  | { readonly kind: 'ship'; readonly shipId: ShipId }
  | { readonly kind: 'harbor' }
  | { readonly kind: 'island'; readonly playerId: PlayerId }
  | { readonly kind: 'building'; readonly playerId: PlayerId; readonly building: BuildingId }
  /** V0.8 prototype: the one building a player raised with materials (scene/Facility.tsx). */
  | { readonly kind: 'facility'; readonly playerId: PlayerId };

/** V0.8 prototype: a building's own show in among the flights (scene/FacilityWorks.tsx), and the crates it puts on screen. */
export interface FacilityWork extends Pick<FacilityReaction, 'building' | 'effect' | 'shields'> {
  readonly goods: readonly GoodId[];
}

export interface Flight {
  readonly key: string;
  /**
   * What moves it: the cash reason, or insured, salvaged or spoiled goods (its sound). 'inspection' is 軍火查緝 (§7.4):
   * the arms crates the bank takes off a ship, shown before anything is paid.
   */
  readonly kind: CashReason | 'salvage' | 'spoil' | 'facility' | 'inspection';
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
  /** V0.8 prototype: this entry is a building at work, not a coin or a crate in the air (no money moves with it). */
  readonly work?: FacilityWork;
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
    'goods-confiscated': { from: fromShip, to: island(e.playerId) },
    'pirate-loot': { from: fromShip, to: island(e.playerId) },
    insurance: { from: HARBOR, to: building(e.playerId, 'insurance'), building: 'insurance' },
    'exchange-commission': { from: HARBOR, to: building(e.playerId, 'exchange'), building: 'exchange' },
    // V0.8 prototype (v08.armory.refundSunkLoot): what the armory kept from the pirates on its owner's sunk ship comes home to the tower.
    'armory-refund': { from: fromShip, to: { kind: 'facility', playerId: e.playerId } },
    // V0.8 prototype (v08.tradehouse.buyoutPercent / buyoutFloor): the tradehouse pays its owner for the crate it took from the warehouse.
    'tradehouse-buyout': { from: { kind: 'facility', playerId: e.playerId }, to: island(e.playerId) },
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
  const sorted = flights.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i).map(({ f }) => f);
  // The inspection comes before any sale (§5 step 6): its crates are gone by the time the ships are paid.
  return [...inspectionFlights(events, round), ...facilityWorks(events, round).reduce(withWork, sorted)];
}

/** 軍火查緝 (§7.4): the arms crates taken off each inspected ship go to the harbor (the bank); no money moves. */
export function inspectionFlights(events: readonly MatchEvent[], round: number): Flight[] {
  return inspections(events, round).map(
    (i): Flight => ({ key: `inspection-${round}-${i.shipId}`, kind: 'inspection', from: ship(i.shipId), to: HARBOR, playerId: i.playerId, amount: null, good: 'arms', units: i.crates, label: inspectionLabel(i), shipId: i.shipId, building: null }),
  );
}

/** V0.8 prototype: the buildings' shows of `round` that play in the settlement, in event order. */
export function facilityWorks(events: readonly MatchEvent[], round: number): Flight[] {
  return facilityReactions(events, round)
    .filter((r) => SETTLED_EFFECTS.has(r.effect))
    .map((r, i): Flight => {
      const at: Place = r.shipId === null ? HARBOR : ship(r.shipId);
      const home: Place = { kind: 'facility', playerId: r.playerId };
      // The armory's guns go out to the ship; the toll and the tradehouse's pay come home.
      const out = r.building === 'armory' && r.effect !== 'pirate-toll';
      const work: FacilityWork = { building: r.building, effect: r.effect, goods: workGoods(events, round, r), ...(r.shields ? { shields: r.shields } : {}) };
      return { key: `work-${round}-${i}`, kind: 'facility', from: out ? home : at, to: out ? at : home, playerId: r.playerId, amount: null, good: null, units: 0, label: r.text, shipId: r.shipId, building: null, work };
    });
}

/** `flights` with a building's show put in front of the flight it changed, or in front of its ship's first flight, or last. */
function withWork(flights: readonly Flight[], work: Flight): Flight[] {
  const before = WORK_BEFORE[work.work!.effect];
  const sameShip = (f: Flight) => f.shipId === work.shipId && f.work === undefined;
  // A show that is about no ship (the tradehouse's buyout) goes with its owner's own payment, not the first player's.
  const changed = flights.findIndex((f) => sameShip(f) && f.kind === before && (work.shipId !== null || f.playerId === work.playerId));
  // After the shows already placed there, so one ship's shows keep the events' order.
  const first = changed >= 0 ? changed : flights.findIndex(sameShip);
  const at = first >= 0 ? first : flights.length;
  return [...flights.slice(0, at), work, ...flights.slice(at)];
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
  readonly arrived: number;
  readonly before: number;
  readonly after: number;
  /** 軍火查緝 (§7.4): crates of this good the bank took (arms only); they count as arrived but sell for nothing. */
  readonly seized: number;
}

/** The market settlement row by row (§7.3); `cardDemand` is the demand card as revealed. */
export function marketRows(events: readonly MatchEvent[], round: number, cardDemand: Goods): MarketRow[] {
  const e = events.find((x): x is Extract<MatchEvent, { type: 'market-settled' }> => x.type === 'market-settled' && x.round === round);
  if (!e) return [];
  return GOODS.map((good) => ({
    good,
    demand: e.demand[good],
    arrived: e.arrived[good],
    before: e.priceBefore[good],
    after: e.priceAfter[good],
    seized: good === 'arms' ? inspectedCrates(events, round) : 0,
  }));
}
