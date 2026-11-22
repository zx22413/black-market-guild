import { chain, changeCash, playerOf } from './cash';
import type { Rules } from './rules';
import type { MatchEvent, MatchState, PlayerId, Ship, Step } from './types';
import { facilityOf } from './v08';

// V0.8 simulation prototype, the armed merchant (docs/proposals/2026-11-playtest-feedback-and-direction.md §10.13):
// an armory owner's ship that leaves with arms aboard is armed (+armedBonus); when other players' pirates target it,
// one crate of arms is spent to repel them all (they count as absent; with counterBlunts they only lose their modifier)
// and each repelling fines its pirate's owner.
// NOT rules. With v08.armory.armedBonus and v08.armory.counter at 0 nothing changes.

/** The armed merchant is on: the +1 or the counterattack. */
const armedOn = (rules: Rules): boolean => rules.v08.armory.armedBonus !== 0 || rules.v08.armory.counter === 1;

/**
 * The armory's +armedBonus on an armed ship whose final without it is `without` (0 otherwise); with armedMaxFinal > 0
 * only when `without` is at most armedMaxFinal (the bonus saves a ship about to sink or lose most of its cargo).
 */
export function armedShift(rules: Rules, ship: Ship, without: number): number {
  if (ship.armed !== true) return 0;
  const { armedBonus, armedMaxFinal } = rules.v08.armory;
  return armedMaxFinal > 0 && without > armedMaxFinal ? 0 : armedBonus;
}

/** Other players' pirates aiming at this ship this round (the diplomat's voided ones are already gone). */
function opposingPirates(state: MatchState, ship: Ship): PlayerId[] {
  return [...state.roundState.carried, ...state.roundState.deployments]
    .filter((d) => d.role === 'pirate' && d.targetShipId === ship.id && d.playerId !== ship.owner)
    .map((d) => d.playerId);
}

/**
 * Marks the ships resolving this round that leave armed, and lets each armed ship repel its pirates: one crate of arms
 * is taken off the ship (never sold, confiscated or lost), the ship is `repelled`, and every pirate's owner pays the
 * ship's owner the fine (capped at their cash).
 */
export function armShips(state: MatchState): Step {
  const { rules } = state;
  if (!armedOn(rules)) return { state, events: [] };
  const fines: ((s: MatchState) => Step)[] = [];
  const reports: MatchEvent[] = [];
  const fighters: PlayerId[] = [];
  const ships = state.roundState.ships.map((ship): Ship => {
    if (ship.cargo.arms <= 0 || facilityOf(rules, playerOf(state, ship.owner)) !== 'armory') return ship;
    const armed: Ship = { ...ship, armed: true };
    // Report only: the ship leaves armed (its +1 shows in the voyage modifiers).
    if (rules.v08.armory.armedBonus !== 0) reports.push({ type: 'v08-effect', round: state.round, playerId: ship.owner, shipId: ship.id, effect: 'armory-armed', crates: 0, value: 0 });
    // v08.armory.counterArms: the crates the counterattack spends (0 = all aboard); too few aboard, no counterattack.
    const spent = rules.v08.armory.counterArms === 0 ? ship.cargo.arms : rules.v08.armory.counterArms;
    // v08.armory.counterCharges: an owner who used up the match's counterattacks only keeps the +1.
    const charged = rules.v08.armory.counterCharges === 0 || (playerOf(state, ship.owner).counterUsed ?? 0) < rules.v08.armory.counterCharges;
    const pirates = rules.v08.armory.counter === 1 && charged && ship.cargo.arms >= spent ? opposingPirates(state, ship) : [];
    if (pirates.length === 0) return armed;
    fighters.push(ship.owner);
    const fine = rules.v08.armory.counterFine;
    const paid = pirates.reduce((sum, p) => sum + Math.min(fine, playerOf(state, p).cash), 0);
    reports.push({ type: 'v08-effect', round: state.round, playerId: ship.owner, shipId: ship.id, effect: 'armory-counter', crates: spent, value: paid });
    for (const p of pirates) {
      fines.push((s) => {
        const amount = Math.min(fine, playerOf(s, p).cash);
        if (amount <= 0) return { state: s, events: [] };
        return chain(s, [(t) => changeCash(t, p, -amount, 'armory-fine', ship.id), (t) => changeCash(t, ship.owner, amount, 'armory-fine', ship.id)]);
      });
    }
    const fought: Ship = rules.v08.armory.counterBlunts === 1 ? { ...armed, blunted: true } : { ...armed, repelled: true };
    return { ...fought, cargo: { ...ship.cargo, arms: ship.cargo.arms - spent } };
  });
  const players = state.players.map((p) => {
    const fought = fighters.filter((id) => id === p.id).length;
    return fought === 0 ? p : { ...p, counterUsed: (p.counterUsed ?? 0) + fought };
  });
  const next: MatchState = { ...state, players, roundState: { ...state.roundState, ships } };
  const paid = chain(next, fines);
  return { state: paid.state, events: [...reports, ...paid.events] };
}
