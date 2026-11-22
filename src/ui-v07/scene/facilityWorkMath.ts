import type { Vec3 } from '../../ui/scene/layout';
import { FACILITY_LOT, FACILITY_SCALE } from './facilityLot';

// V0.8 prototype (an experiment, not rules): the armory and the tradehouse doing their work during the settlement, as
// plain data. The armory's guns fire on the ship the pirates (or customs) are at and what they would have taken comes
// back to the tower; the tradehouse hoists the crates it sells at the old price over its roof, seals each in gold and
// pays out from them. Where and when everything is comes from here; scene/FacilityWorks.tsx only draws it.

/** How long one building's show holds the settlement (seconds). */
export const WORK_SECONDS = 2.3;

/** Island space (y from the plateau): the armory's gun deck and the tradehouse's roof ridge, at the size they stand. */
export const GUN_DECK: Vec3 = [FACILITY_LOT[0], 3.1 * FACILITY_SCALE, FACILITY_LOT[2]];
export const TRADE_ROOF: Vec3 = [FACILITY_LOT[0], 5.1 * FACILITY_SCALE, FACILITY_LOT[2]];

/** The armory's volley: when each gun fires, how long a ball flies and how high it arcs, how wide they land. */
export const VOLLEY = { shots: 3, first: 0.15, gap: 0.2, flight: 0.6, arc: 7, spread: 3 } as const;
/** What the guns won back: coins from the ship to the tower once the last ball has landed. */
export const RETURN = { coins: 3, after: 0.12, gap: 0.14, flight: 0.7, arc: 8 } as const;

export const firesAt = (i: number): number => VOLLEY.first + i * VOLLEY.gap;
export const hitsAt = (i: number): number => firesAt(i) + VOLLEY.flight;
/** When coin `i` leaves the ship for the tower. */
export const returnsAt = (i: number): number => hitsAt(VOLLEY.shots - 1) + RETURN.after + i * RETURN.gap;

/** A point `k` (0…1) of the way from `from` to `to` on an arc `arc` high at its middle. */
export function arcPoint(from: Vec3, to: Vec3, k: number, arc: number): Vec3 {
  return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k + arc * 4 * k * (1 - k), from[2] + (to[2] - from[2]) * k];
}

/** Where ball `i` comes down: round the ship, never twice on one spot. */
export function hitSpot(ship: Vec3, i: number): Vec3 {
  const a = (i / VOLLEY.shots) * Math.PI * 2 + 0.6;
  return [ship[0] + Math.cos(a) * VOLLEY.spread, ship[1], ship[2] + Math.sin(a) * VOLLEY.spread];
}

/** Ball `i` at `t` seconds into the show: null before it is fired and once it has landed. */
export function ballPose(deck: Vec3, ship: Vec3, i: number, t: number): Vec3 | null {
  const k = (t - firesAt(i)) / VOLLEY.flight;
  return k < 0 || k > 1 ? null : arcPoint(deck, hitSpot(ship, i), k, VOLLEY.arc);
}

/** Coin `i` on its way from the ship to the tower at `t`, starting at `startsAt(i)`: null before and after. */
export function coinPose(from: Vec3, to: Vec3, i: number, t: number, startsAt: (i: number) => number, flight: number, arc: number): Vec3 | null {
  const k = (t - startsAt(i)) / flight;
  return k < 0 || k > 1 ? null : arcPoint(from, to, k, arc);
}

/**
 * The tradehouse's seal: the crates come up out of the roof one after another and hang over it, a gold ring closes
 * round each (the stamp), a coin drops from each to the island, then they go back down.
 */
export const SEAL = { max: 3, gap: 0.16, rise: 0.4, lift: 3.6, apart: 2.9, stamp: 0.85, close: 0.22, pay: 1.3, flight: 0.6, arc: 4, leave: 1.95, gone: 0.3 } as const;

export const stampsAt = (i: number): number => SEAL.stamp + i * SEAL.gap;
export const paysAt = (i: number): number => SEAL.pay + i * SEAL.gap;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const easeOutBack = (k: number): number => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;

export interface CratePose {
  /** Sideways from the roof's middle (island x) and up from the ridge. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  /** The crate carries its gold seal from the stamp on. */
  readonly sealed: boolean;
  /** The ring closing round it: 1 wide open … 0 shut on the crate; null when there is no ring. */
  readonly ring: number | null;
}

/** Crate `i` of `n` at `t` seconds into the show; null before it comes up and once it is back down. */
export function cratePose(i: number, n: number, t: number): CratePose | null {
  const since = t - i * SEAL.gap;
  if (since < 0 || t > SEAL.leave + SEAL.gone) return null;
  const up = easeOutBack(clamp01(since / SEAL.rise));
  const out = clamp01((t - SEAL.leave) / SEAL.gone);
  const closing = (t - stampsAt(i)) / SEAL.close;
  return {
    x: (i - (n - 1) / 2) * SEAL.apart,
    y: SEAL.lift * up * (1 - out),
    scale: Math.max(0, Math.min(1, up)) * (1 - out),
    sealed: closing >= 1,
    ring: closing >= 0 && closing < 1.6 ? Math.max(0, 1 - closing) : null,
  };
}

/** Island space: the repair yard's slip, where its planks leave from. */
export const YARD_SLIP: Vec3 = [FACILITY_LOT[0], 2.2 * FACILITY_SCALE, FACILITY_LOT[2]];
/**
 * The repair yard's run: planks fly from the slip to the ship and are nailed on one after another, then the crates
 * the yard kept on board hop up on the deck.
 */
export const REPAIR = { planks: 4, first: 0.1, gap: 0.15, flight: 0.65, arc: 8, spread: 1.8, max: 3, hop: 0.5, apart: 2.6 } as const;

export const plankLeavesAt = (i: number): number => REPAIR.first + i * REPAIR.gap;
export const plankLandsAt = (i: number): number => plankLeavesAt(i) + REPAIR.flight;
/** When kept crate `i` hops up on the deck: once the last plank is on. */
export const keptAt = (i: number): number => plankLandsAt(REPAIR.planks - 1) + 0.05 + i * 0.12;

/** Where plank `i` is nailed on: along the hull, alternating sides. */
export function plankSpot(ship: Vec3, i: number): Vec3 {
  return [ship[0] + (i - (REPAIR.planks - 1) / 2) * REPAIR.spread, ship[1], ship[2] + (i % 2 === 0 ? 0.8 : -0.8)];
}

/** Plank `i` at `t`: null before it leaves the slip and once it is nailed on. */
export function plankPose(slip: Vec3, ship: Vec3, i: number, t: number): Vec3 | null {
  const k = (t - plankLeavesAt(i)) / REPAIR.flight;
  return k < 0 || k > 1 ? null : arcPoint(slip, plankSpot(ship, i), k, REPAIR.arc);
}

/** Kept crate `i` of `n` over the deck at `t`: sideways offset, height above the ship's point and size; null until it hops up. */
export function keptPose(i: number, n: number, t: number): { readonly x: number; readonly y: number; readonly scale: number } | null {
  const since = t - keptAt(i);
  if (since < 0) return null;
  const k = clamp01(since / REPAIR.hop);
  const out = clamp01((t - (WORK_SECONDS - 0.3)) / 0.3);
  return { x: (i - (n - 1) / 2) * REPAIR.apart, y: 2.2 + Math.sin(k * Math.PI) * 2.4 + 1.2 * k, scale: easeOutBack(k) * (1 - out) };
}
