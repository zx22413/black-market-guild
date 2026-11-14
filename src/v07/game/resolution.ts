import { holds, playerOf } from './cash';
import { shipFinalCapFor, traitOf } from './islands';
import { mapGoods, priceAt } from './goods';
import { nextInt, type RngState } from './rng';
import { shipSinks } from './rules';
import { GOODS, type Deployment, type MatchEvent, type MatchState, type Ship, type Step, type VoyageModifier, type VoyageOutcome } from './types';
import { crateTerms, extraDieFrom, facilityOf, repairyardSaved, rerolls, skillLevel, takeHighest, v08On, type CrateContext, type CrateTerms } from './v08';

/** §5 step 1: draws and reveals the voyage event as the round opens. */
export function revealVoyageEvent(state: MatchState): Step {
  const [card, ...rest] = state.voyageDeck;
  if (card === undefined) {
    throw new Error('voyage deck is empty');
  }
  return {
    state: { ...state, voyageDeck: rest, roundState: { ...state.roundState, voyageEvent: card } },
    events: [{ type: 'voyage-event-revealed', round: state.round, event: card }],
  };
}

/** This round's deployments and those pre-deployed on a freighter that has now arrived (game-design.md §8.1). */
export const effectiveDeployments = (state: MatchState): readonly Deployment[] => [...state.roundState.carried, ...state.roundState.deployments];

function targeting(state: MatchState, ship: Ship, role: Deployment['role']): Deployment[] {
  return effectiveDeployments(state).filter((d) => d.role === role && d.targetShipId === ship.id);
}

/** §12: "targeted by a role" effects count once however many players target the ship. */
function eventModifier(state: MatchState, ship: Ship): number {
  const v = state.rules.voyageEvents;
  switch (state.roundState.voyageEvent) {
    case 'tailwind':
      return v.tailwind;
    case 'storm':
      return v.storm;
    case 'sea-fog':
      return targeting(state, ship, 'pirate').length > 0 ? v.seaFog : 0;
    case 'moonless-night':
      return targeting(state, ship, 'guard').length > 0 ? v.moonlessNight : 0;
    case 'black-market-rush':
    case 'calm-seas':
    case null:
      return 0;
  }
}

/** §9.1: roll → guards → pirates → voyage event → island → clamp. */
export function voyageModifier(state: MatchState, ship: Ship): VoyageModifier {
  const { rules } = state;
  const trait = (playerId: string) => traitOf(rules, playerOf(state, playerId).island);
  const base = ship.rawRoll;
  const guard = targeting(state, ship, 'guard').reduce(
    (sum, d) =>
      sum + rules.roles.guard.modifier + trait(d.playerId).guardModifier,
    0,
  );
  // + 0 turns -0 into 0.
  const pirate = targeting(state, ship, 'pirate').reduce((sum, d) => sum + rules.roles.pirate.modifier + trait(d.playerId).pirateModifier, 0) + 0;
  const event = eventModifier(state, ship) + 0;
  const island = trait(ship.owner).ownShipModifier + 0;
  const final = Math.min(shipFinalCapFor(rules, playerOf(state, ship.owner).island, ship.type), Math.max(rules.sailing.dieMin, base + guard + pirate + event + island));
  return { shipId: ship.id, base, guard, pirate, event, island, final };
}

export function outcomeOf(state: MatchState, ship: Ship, value: number): VoyageOutcome {
  return shipSinks(state.rules, ship.type, value) ? 'sank' : 'arrived';
}

/** §5 step 7: announces every ship's modifiers, then each outcome with its now-public cargo. */
export function resolveVoyages(state: MatchState): Step {
  if (v08On(state.rules)) {
    return resolveVoyagesV08(state);
  }
  const summaries = state.roundState.ships.map((ship) => voyageModifier(state, ship));
  const ships = state.roundState.ships.map((ship, i) => ({ ...ship, outcome: outcomeOf(state, ship, summaries[i]!.final) }));
  return {
    state: { ...state, roundState: { ...state.roundState, ships } },
    events: [
      ...(ships.length > 0 ? [{ type: 'voyage-modifiers' as const, round: state.round, modifiers: summaries }] : []),
      ...ships.map((ship) => ({ type: 'ship-resolved' as const, round: state.round, shipId: ship.id, outcome: ship.outcome, cargo: ship.cargo })),
    ],
  };
}

/** V0.8 prototype: the owner's skill level, building and island that shape a ship's voyage terms. */
export function crateContext(state: MatchState, ship: Ship): CrateContext {
  const owner = playerOf(state, ship.owner);
  return { raised: ship.raised === true, level: skillLevel(state.rules, owner, ship.type), facility: facilityOf(state.rules, owner), island: owner.island };
}

/** V0.8 prototype: a ship's voyage terms at its (final) final value. */
export function termsOf(state: MatchState, ship: Ship): CrateTerms {
  return crateTerms(state.rules, ship.type, voyageModifier(state, ship).final, crateContext(state, ship));
}

interface Rolled {
  readonly state: MatchState;
  readonly ship: Ship;
  readonly events: readonly MatchEvent[];
}

const effect = (state: MatchState, ship: Ship, kind: 'reroll' | 'reroll-saved' | 'extra-die' | 'repairyard', crates = 0, value = 0): MatchEvent => ({
  type: 'v08-effect',
  round: state.round,
  playerId: ship.owner,
  shipId: ship.id,
  effect: kind,
  crates,
  value,
});

/** For the report only: what a voyage's terms pay for its cargo at the price before the market change (no roles, no island bonus). */
function paidAt(state: MatchState, ship: Ship, terms: CrateTerms): number {
  if (terms.sinks) return 0;
  const lost = takeHighest(state.rules, ship.cargo, terms.lose, state.prices);
  const value = GOODS.reduce((sum, g) => sum + (ship.cargo[g] - lost[g]) * priceAt(state.rules, g, state.prices[g]), 0);
  return Math.floor((value * terms.percent) / 100);
}

function roll(state: MatchState, sides?: number): { value: number; rng: RngState } {
  const step = sides === undefined ? nextInt(state.rng, state.rules.sailing.dieMin, state.rules.sailing.dieMax) : nextInt(state.rng, 1, sides);
  return { value: step.value, rng: step.state };
}

/**
 * V0.8 prototype: the breaker's extra die (before modifiers), then the standard ship's one reroll (all modifiers again),
 * both from the match rng in ship order; the final raw die is kept on the ship so the market sees the same final.
 */
function rollSkills(state: MatchState, ship: Ship): Rolled {
  const level = crateContext(state, ship).level;
  if (ship.type === 'breaker' && ship.rawRoll >= extraDieFrom(state.rules, level)) {
    // v08.breaker.extraDieSides: the extra die is 1dN (6 rolls the normal die exactly as before).
    const sides = state.rules.v08.breaker.extraDieSides;
    const extra = roll(state, sides === state.rules.sailing.dieMax && state.rules.sailing.dieMin === 1 ? undefined : sides);
    const next = { ...ship, rawRoll: ship.rawRoll + extra.value };
    const gain = paidAt(state, next, termsOf(state, next)) - paidAt(state, ship, termsOf(state, ship));
    return { state: { ...state, rng: extra.rng }, ship: next, events: [effect(state, ship, 'extra-die', extra.value, gain)] };
  }
  const before = termsOf(state, ship);
  if (ship.type === 'standard' && rerolls(state.rules, level, before.sinks, voyageModifier(state, ship).final)) {
    const again = roll(state);
    const next = { ...ship, rawRoll: again.value };
    const after = crateTerms(state.rules, ship.type, voyageModifier(state, next).final, crateContext(state, next));
    const gain = paidAt(state, next, after) - paidAt(state, ship, before);
    const saved = before.sinks && !after.sinks ? [effect(state, ship, 'reroll-saved')] : [];
    return { state: { ...state, rng: again.rng }, ship: next, events: [effect(state, ship, 'reroll', 0, gain), ...saved] };
  }
  return { state, ship, events: [] };
}

/**
 * V0.8 prototype: the crates an arrived ship loses. With hidden.privateLoses the private crates join the pool (highest
 * price first, regular crates of a good before private ones); `privateCargo` then keeps only the private crates that arrive.
 */
function loseCrates(state: MatchState, ship: Ship, count: number): Pick<Ship, 'lost' | 'privateCargo'> {
  const priv = ship.privateCargo;
  if (priv === undefined || state.rules.v08.hidden.privateLoses !== 1) {
    return { lost: takeHighest(state.rules, ship.cargo, count, state.prices), ...(priv === undefined ? {} : { privateCargo: priv }) };
  }
  const pool = takeHighest(state.rules, mapGoods((g) => ship.cargo[g] + priv[g]), count, state.prices);
  const lost = mapGoods((g) => Math.min(pool[g], ship.cargo[g]));
  return { lost, privateCargo: mapGoods((g) => priv[g] - (pool[g] - lost[g])) };
}

function resolveVoyagesV08(state: MatchState): Step {
  let current = state;
  const skillEvents: MatchEvent[] = [];
  const rolled = state.roundState.ships.map((ship) => {
    const r = rollSkills(current, ship);
    current = r.state;
    skillEvents.push(...r.events);
    return r.ship;
  });
  const summaries = rolled.map((ship) => voyageModifier(current, ship));
  const ships = rolled.map((ship, i): Ship => {
    const final = summaries[i]!.final;
    const terms = crateTerms(current.rules, ship.type, final, crateContext(current, ship));
    const saved = repairyardSaved(current.rules, ship.type, final, crateContext(current, ship));
    if (saved > 0) {
      const without = crateTerms(current.rules, ship.type, final, { ...crateContext(current, ship), facility: null });
      skillEvents.push(effect(current, ship, 'repairyard', saved, paidAt(current, ship, terms) - paidAt(current, ship, without)));
    }
    // Lost crates go highest price first, at the price before this round's market change.
    if (terms.sinks) return { ...ship, outcome: 'sank' };
    return { ...ship, outcome: 'arrived', ...loseCrates(current, ship, terms.lose) };
  });
  return {
    state: { ...current, roundState: { ...current.roundState, ships } },
    events: [
      ...skillEvents,
      ...(ships.length > 0 ? [{ type: 'voyage-modifiers' as const, round: state.round, modifiers: summaries }] : []),
      ...ships.map((ship) => ({
        type: 'ship-resolved' as const,
        round: state.round,
        shipId: ship.id,
        outcome: ship.outcome!,
        cargo: ship.cargo,
        ...(ship.lost === undefined ? {} : { lost: ship.lost }),
        ...(ship.privateCargo === undefined ? {} : { privateCargo: ship.privateCargo }),
      })),
    ],
  };
}
