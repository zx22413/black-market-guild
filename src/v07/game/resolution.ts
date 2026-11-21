import { holds, playerOf } from './cash';
import { shipFinalCapFor, traitOf } from './islands';
import { mapGoods, priceAt } from './goods';
import { FINAL_EFFECTS } from './types';
import { nextInt, type RngState } from './rng';
import { shipDelay, shipSinks } from './rules';
import { GOODS, type Deployment, type FinalRoundEffect, type MatchEvent, type VoyageEventId, type MatchState, type Ship, type Step, type VoyageModifier, type VoyageOutcome } from './types';
import { activeTide, beaconShift, bossSide, darkNight, diceToRoll, eventShift, eventsOn, isLateCard, moonlessShift, islandFaded, ownShipApplies, ownShipShift, pirateModifier, publicEvents, seaFogShift, stormTideLossActs, tideShift } from './v08-events';
import { armShips, armedShift } from './v08-armory';
import { crateTerms, extraDieFrom, facilityOf, repairyardSaved, rerolls, skillLevel, stormShielded, takeHighest, unshieldedTerms, v08On, type CrateContext, type CrateTerms } from './v08';

/** §5 step 1: draws and reveals the voyage event as the round opens. */
export function revealVoyageEvent(state: MatchState): Step {
  if (eventsOn(state.rules) && state.v08Events !== undefined) {
    return revealEventCard(state);
  }
  const [card, ...rest] = state.voyageDeck;
  if (card === undefined) {
    throw new Error('voyage deck is empty');
  }
  return {
    state: { ...state, voyageDeck: rest, roundState: { ...state.roundState, voyageEvent: card } },
    events: [{ type: 'voyage-event-revealed', round: state.round, event: card }],
  };
}

/**
 * V0.8 prototype (v08.events): draws the round's event-deck card. The 1st advance is 「暗潮將至」 (phase II from next
 * round; with v08.events.tides it also picks the tide from the two candidates), the 2nd makes this the final round with
 * a random effect (v08.events.finalBoth: both, 「最後的大市集」); the round cap or an empty deck also ends the match.
 * A late card (v08.events.lateCards) replaces the regular event with its effect for this round.
 */
function revealEventCard(state: MatchState): Step {
  const ev = state.v08Events!;
  const e = state.rules.v08.events;
  const [card, ...deck] = ev.deck;
  if (card === undefined) {
    throw new Error('event deck is empty');
  }
  const advance = card === 'advance';
  const lateCard = isLateCard(card) ? card : null;
  const advancesDrawn = ev.advancesDrawn + (advance ? 1 : 0);
  const darkTide = advance && advancesDrawn === 1;
  const ends = (advance && advancesDrawn >= 2) || state.round >= e.maxRounds || deck.length === 0;
  const both = advance && advancesDrawn >= 2 && e.finalBoth === 1;
  const pick = advance && advancesDrawn >= 2 && !both ? nextInt(state.rng, 0, FINAL_EFFECTS.length - 1) : null;
  const finalEffect: FinalRoundEffect | null = both ? 'final-market' : pick === null ? null : FINAL_EFFECTS[pick.value]!;
  const tidePick = darkTide && e.tides === 1 && ev.tideCandidates.length > 0 ? nextInt(pick?.state ?? state.rng, 0, ev.tideCandidates.length - 1) : null;
  const tide = tidePick === null ? ev.tide : ev.tideCandidates[tidePick.value]!;
  const voyageEvent = advance || lateCard !== null ? null : (card as VoyageEventId);
  const { demand } = state.roundState;
  const boost = e.openMarketDemand;
  const opens = finalEffect === 'open-market' || finalEffect === 'final-market' || lateCard === 'open-market';
  const newDemand = opens ? mapGoods((g) => demand[g] + boost) : demand;
  const next: MatchState = {
    ...state,
    rng: tidePick?.state ?? pick?.state ?? state.rng,
    v08Events: {
      deck,
      advancesDrawn,
      phaseTwoFrom: darkTide ? state.round + 1 : ev.phaseTwoFrom,
      finalRound: ends ? state.round : ev.finalRound,
      finalEffect: ends ? finalEffect : ev.finalEffect,
      tideCandidates: ev.tideCandidates,
      tide,
      lateCard,
    },
    roundState: { ...state.roundState, voyageEvent, demand: newDemand },
  };
  // v08.events.flipOnlyTideCard: only the tide's matching card shows its boss side.
  const boss = voyageEvent !== null && bossSide(publicEvents(next), voyageEvent);
  const events: MatchEvent[] = [
    ...(ev.phaseTwoFrom === state.round ? [{ type: 'phase-two-started' as const, round: state.round }] : []),
    ...(voyageEvent === null ? [] : [{ type: 'voyage-event-revealed' as const, round: state.round, event: voyageEvent }]),
    ...(boss && voyageEvent !== null ? [{ type: 'boss-event' as const, round: state.round, event: voyageEvent }] : []),
    ...(lateCard === null ? [] : [{ type: 'late-card' as const, round: state.round, card: lateCard, demand: newDemand }]),
    ...(darkTide ? [{ type: 'dark-tide-rising' as const, round: state.round }] : []),
    ...(tidePick === null || tide === null ? [] : [{ type: 'tide-revealed' as const, round: state.round, tide }]),
    ...(ends ? [{ type: 'final-round' as const, round: state.round, effect: finalEffect, demand: newDemand }] : []),
  ];
  return { state: next, events };
}

/** This round's deployments and those pre-deployed on a freighter that has now arrived (game-design.md §8.1). */
export const effectiveDeployments = (state: MatchState): readonly Deployment[] => [...state.roundState.carried, ...state.roundState.deployments];

function targeting(state: MatchState, ship: Ship, role: Deployment['role']): Deployment[] {
  // V0.8 prototype (v08.armory.counter): the pirates an armed ship repelled count as absent.
  if (role === 'pirate' && ship.repelled === true) return [];
  return effectiveDeployments(state).filter((d) => d.role === role && d.targetShipId === ship.id);
}

/** §12: "targeted by a role" effects count once however many players target the ship. */
function eventModifier(state: MatchState, ship: Ship): number {
  // V0.8 prototype (v08.events): phase II boss versions; with the switch off these are the plain event values.
  const pe = publicEvents(state);
  const event = state.roundState.voyageEvent;
  // v08.events.tides: 風暴潮 lowers every ship in the rounds after 暗潮將至 (0 otherwise).
  const tide = tideShift(state.rules, activeTide(pe));
  switch (event) {
    case 'tailwind':
    case 'storm':
      return eventShift(state.rules, pe, event) + tide;
    case 'sea-fog':
      return (targeting(state, ship, 'pirate').length > 0 ? seaFogShift(state.rules, pe) : 0) + tide;
    case 'moonless-night':
      return (targeting(state, ship, 'guard').length > 0 ? moonlessShift(state.rules, pe) : 0) + tide;
    case 'black-market-rush':
    case 'calm-seas':
    case null:
      return tide;
  }
}

/** §9.1: roll → guards → pirates → voyage event → island → clamp. */
export function voyageModifier(state: MatchState, ship: Ship): VoyageModifier {
  const { rules } = state;
  const trait = (playerId: string) => traitOf(rules, playerOf(state, playerId).island);
  const base = ship.rawRoll;
  const pe = publicEvents(state);
  const card = state.roundState.voyageEvent;
  // V0.8 prototype (v08.events): a phase II moonless night voids the guards; 海盜伏擊 changes each pirate's modifier.
  const guarded =
    darkNight(pe, card)
      ? 0
      : targeting(state, ship, 'guard').reduce(
          (sum, d) =>
            sum + rules.roles.guard.modifier + trait(d.playerId).guardModifier,
          0,
        );
  // + 0 turns -0 into 0.
  // v08.islands.lighthouseBeacon: the lighthouse lights its owner's ships up for pirates too.
  const beacon = beaconShift(rules, playerOf(state, ship.owner).island);
  const pirate = targeting(state, ship, 'pirate').reduce((sum, d) => sum + pirateModifier(rules, pe, card) + trait(d.playerId).pirateModifier + beacon, 0) + 0;
  const event = eventModifier(state, ship) + 0;
  // v08.islands.ownShipMinRaw: the lighthouse's +1 only on a raw die of 3 or more.
  const island = (ownShipApplies(rules, base) ? ownShipShift(rules, trait(ship.owner).ownShipModifier, pe) : 0) + 0;
  // v08.islands.lighthouseFades: in phase II the island's own cap fades too (only the ship type's cap remains).
  const capIsland = islandFaded(rules, pe) ? null : playerOf(state, ship.owner).island;
  const clamp = (value: number) => Math.min(shipFinalCapFor(rules, capIsland, ship.type), Math.max(rules.sailing.dieMin, value));
  // V0.8 prototype (v08.armory.armedBonus / armedMaxFinal): the armed merchant's +1 counts with the guards (a moonless
  // night keeps it), and with armedMaxFinal only when the final without it would be that low.
  const guard = guarded + armedShift(rules, ship, clamp(base + guarded + pirate + event + island));
  const final = clamp(base + guard + pirate + event + island);
  return { shipId: ship.id, base, guard, pirate, event, island, final };
}

export function outcomeOf(state: MatchState, ship: Ship, value: number): VoyageOutcome {
  return shipSinks(state.rules, ship.type, value) ? 'sank' : 'arrived';
}

/** §5 step 7: announces every ship's modifiers, then each outcome with its now-public cargo. */
export function resolveVoyages(input: MatchState): Step {
  if (v08On(input.rules)) {
    return resolveVoyagesV08(input);
  }
  const state = lastGambleArrivals(input);
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
  const context: CrateContext = { raised: ship.raised === true, level: skillLevel(state.rules, owner, ship.type), facility: facilityOf(state.rules, owner), island: owner.island };
  // v08.events.tideStormExtraLoss: the storm tide's extra crate loss (only added when it acts, so the context is unchanged otherwise).
  return stormTideLossActs(state.rules, activeTide(publicEvents(state))) ? { ...context, stormTide: true } : context;
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

const effect = (state: MatchState, ship: Ship, kind: 'reroll' | 'reroll-saved' | 'extra-die' | 'repairyard' | 'storm-tide' | 'storm-shield', crates = 0, value = 0): MatchEvent => ({
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

/**
 * V0.8 prototype (最後一搏): a ship launched in an earlier round (a freighter) rolled its die then; in the final round its
 * raw die becomes the best of that die and `lastGambleDice − 1` new ones, like the ships launched now.
 */
function lastGambleArrivals(state: MatchState): MatchState {
  const dice = diceToRoll(state.rules, publicEvents(state));
  if (dice <= 1) return state;
  let rng = state.rng;
  const ships = state.roundState.ships.map((ship) => {
    if (ship.arriveRound - shipDelay(state.rules, ship.type) < state.round) {
      let raw = ship.rawRoll;
      for (let k = 1; k < dice; k += 1) {
        const step = nextInt(rng, state.rules.sailing.dieMin, state.rules.sailing.dieMax);
        rng = step.state;
        raw = Math.max(raw, step.value);
      }
      return { ...ship, rawRoll: raw };
    }
    return ship;
  });
  return { ...state, rng, roundState: { ...state.roundState, ships } };
}

/**
 * 風暴潮 (v08.events.tideStormExtraLoss): the report event for the crates an arriving ship lost to the storm tide
 * (crates actually taken, at most what is aboard; value = the income lost, negative), or null.
 */
function stormTideLost(state: MatchState, ship: Ship, final: number, terms: CrateTerms): MatchEvent | null {
  const context = crateContext(state, ship);
  if (terms.sinks || context.stormTide !== true) return null;
  const calm = crateTerms(state.rules, ship.type, final, { ...context, stormTide: false });
  // v08.repairyard.immuneStormTide: a shielded ship loses nothing to the tide; report what the shield kept instead.
  const shielded = stormShielded(state.rules, context);
  const hit = shielded ? unshieldedTerms(state.rules, ship.type, final, context) : terms;
  const aboard = GOODS.reduce((sum, g) => sum + ship.cargo[g] + (state.rules.v08.hidden.privateLoses === 1 ? (ship.privateCargo?.[g] ?? 0) : 0), 0);
  const crates = Math.min(hit.lose, aboard) - Math.min(calm.lose, aboard);
  if (crates <= 0) return null;
  return shielded
    ? effect(state, ship, 'storm-shield', crates, paidAt(state, ship, calm) - paidAt(state, ship, hit))
    : effect(state, ship, 'storm-tide', crates, paidAt(state, ship, terms) - paidAt(state, ship, calm));
}

function resolveVoyagesV08(input: MatchState): Step {
  // V0.8 prototype (v08.armory): armed ships repel their pirates before any final value is read.
  const armed = armShips(lastGambleArrivals(input));
  const state = armed.state;
  let current = state;
  const skillEvents: MatchEvent[] = [...armed.events];
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
      // The normal save only (a storm-shielded ship's tide loss is reported as 'storm-shield').
      const context = crateContext(current, ship);
      const without = crateTerms(current.rules, ship.type, final, { ...context, facility: null, ...(stormShielded(current.rules, context) ? { stormTide: false } : {}) });
      skillEvents.push(effect(current, ship, 'repairyard', saved, paidAt(current, ship, terms) - paidAt(current, ship, without)));
    }
    const storm = stormTideLost(current, ship, final, terms);
    if (storm !== null) skillEvents.push(storm);
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
