import { chain, changeCash, playerOf } from './cash';
import type { Rules } from './rules';
import type { MatchEvent, MatchState, PlayerId, Ship, Step } from './types';
import { facilityOf } from './v08';

// V0.8 simulation prototype, the armed merchant (docs/proposals/2026-11-playtest-feedback-and-direction.md §10.13):
// an armory owner's ship that leaves with arms aboard is armed (+armedBonus); when other players' pirates target it,
// one crate of arms is spent to repel them all (they count as absent) and each repelling fines its pirate's owner.
// NOT rules. With v08.armory.armedBonus and v08.armory.counter at 0 nothing changes.

/** The armed merchant is on: the +1 or the counterattack. */
const armedOn = (rules: Rules): boolean => rules.v08.armory.armedBonus !== 0 || rules.v08.armory.counter === 1;

/** The armory's +armedBonus on an armed ship (0 otherwise). */
export const armedShift = (rules: Rules, ship: Ship): number => (ship.armed === true ? rules.v08.armory.armedBonus : 0);

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
  const ships = state.roundState.ships.map((ship): Ship => {
    if (ship.cargo.arms <= 0 || facilityOf(rules, playerOf(state, ship.owner)) !== 'armory') return ship;
    const armed: Ship = { ...ship, armed: true };
    // Report only: the ship leaves armed (its +1 shows in the voyage modifiers).
    if (rules.v08.armory.armedBonus !== 0) reports.push({ type: 'v08-effect', round: state.round, playerId: ship.owner, shipId: ship.id, effect: 'armory-armed', crates: 0, value: 0 });
    const pirates = rules.v08.armory.counter === 1 ? opposingPirates(state, ship) : [];
    if (pirates.length === 0) return armed;
    const fine = rules.v08.armory.counterFine;
    const paid = pirates.reduce((sum, p) => sum + Math.min(fine, playerOf(state, p).cash), 0);
    reports.push({ type: 'v08-effect', round: state.round, playerId: ship.owner, shipId: ship.id, effect: 'armory-counter', crates: 1, value: paid });
    for (const p of pirates) {
      fines.push((s) => {
        const amount = Math.min(fine, playerOf(s, p).cash);
        if (amount <= 0) return { state: s, events: [] };
        return chain(s, [(t) => changeCash(t, p, -amount, 'armory-fine', ship.id), (t) => changeCash(t, ship.owner, amount, 'armory-fine', ship.id)]);
      });
    }
    return { ...armed, repelled: true, cargo: { ...ship.cargo, arms: ship.cargo.arms - 1 } };
  });
  const next: MatchState = { ...state, roundState: { ...state.roundState, ships } };
  const paid = chain(next, fines);
  return { state: paid.state, events: [...reports, ...paid.events] };
}
