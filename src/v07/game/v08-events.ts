import { nextPriceStep } from './goods';
import { nextInt, shuffle, type RngState } from './rng';
import type { Rules } from './rules';
import type { GoodId, MatchState, PublicEvents, V08Card, V08EventsState, VoyageEventId } from './types';

// V0.8 simulation prototype (v08.events): the event deck sets the match length and splits it into two phases; the
// regular voyage events have boss versions in phase II. NOT rules. With the switch off every helper below returns the
// V0.7.1 value, so the engine and the bots can call them unconditionally.

export const eventsOn = (rules: Rules): boolean => rules.v08.events.enabled === 1;

/**
 * The event deck: the shuffled regular voyage events, with the 1st advance at a uniformly random round in
 * firstAdvanceFrom–firstAdvanceTo and the 2nd in secondAdvanceFrom–secondAdvanceTo. Positions past the 2nd advance are
 * never drawn, so the deck stops there (or earlier if the regular cards run out).
 */
export function buildEventDeck(rules: Rules, regular: readonly VoyageEventId[], rng: RngState): { readonly deck: V08Card[]; readonly rng: RngState } {
  const e = rules.v08.events;
  const shuffled = shuffle(regular, rng);
  const first = nextInt(shuffled.state, e.firstAdvanceFrom, e.firstAdvanceTo);
  const second = nextInt(first.state, e.secondAdvanceFrom, e.secondAdvanceTo);
  const deck: V08Card[] = [];
  let next = 0;
  for (let round = 1; round <= e.secondAdvanceTo; round += 1) {
    if (round === first.value || round === second.value) {
      deck.push('advance');
      continue;
    }
    const card = shuffled.items[next];
    if (card === undefined) break;
    deck.push(card);
    next += 1;
  }
  return { deck, rng: second.state };
}

export const initialEventsState = (deck: readonly V08Card[]): V08EventsState => ({ deck, advancesDrawn: 0, phaseTwoFrom: null, finalRound: null, finalEffect: null });

/** The public event status of the current round; undefined when the switch is off. */
export function publicEvents(state: MatchState): PublicEvents | undefined {
  const ev = state.v08Events;
  if (!eventsOn(state.rules) || ev === undefined) return undefined;
  const finalRound = ev.finalRound !== null && ev.finalRound === state.round;
  return {
    phase: ev.phaseTwoFrom !== null && state.round >= ev.phaseTwoFrom ? 2 : 1,
    advancesDrawn: ev.advancesDrawn,
    darkTide: ev.phaseTwoFrom !== null && ev.phaseTwoFrom === state.round + 1,
    finalRound,
    finalEffect: finalRound ? ev.finalEffect : null,
    deckRemaining: ev.deck.length,
  };
}

/** Whether the current round is the last one: round `rules.rounds` with the switch off; else the known final round. */
export function isFinalRound(state: MatchState): boolean {
  if (!eventsOn(state.rules)) return state.round >= state.rules.rounds;
  return state.round >= state.rules.v08.events.maxRounds || state.v08Events?.finalRound === state.round;
}

/** A ship launched now that resolves `delay` rounds later still arrives before the match ends. */
export function arrivesInTime(state: MatchState, delay: number): boolean {
  if (!eventsOn(state.rules)) return state.round + delay <= state.rules.rounds;
  return delay === 0 || (!isFinalRound(state) && state.round + delay <= state.rules.v08.events.maxRounds);
}

/** The most rounds a match can last (deck sizes are checked against it). */
export const roundCap = (rules: Rules): number => (eventsOn(rules) ? rules.v08.events.maxRounds : rules.rounds);

const boss = (pe: PublicEvents | undefined): boolean => pe?.phase === 2;

/** The unconditional part of a voyage event's modifier (tailwind, storm); phase II doubles them by default. */
export function eventShift(rules: Rules, pe: PublicEvents | undefined, event: VoyageEventId | null): number {
  const v = rules.voyageEvents;
  if (event === 'tailwind') return boss(pe) ? rules.v08.events.bossTailwind : v.tailwind;
  if (event === 'storm') return boss(pe) ? rules.v08.events.bossStorm : v.storm;
  return 0;
}

/** Sea fog: pirate-targeted ships +1 in phase I; nothing in phase II (海盜伏擊 changes the pirate modifier instead). */
export const seaFogShift = (rules: Rules, pe: PublicEvents | undefined): number => (boss(pe) ? 0 : rules.voyageEvents.seaFog);

/** Moonless night: guard-targeted ships −1 in phase I; nothing in phase II (the guard is void instead). */
export const moonlessShift = (rules: Rules, pe: PublicEvents | undefined): number => (boss(pe) ? 0 : rules.voyageEvents.moonlessNight);

/** Each pirate's base modifier (before its island): 海盜伏擊 in phase II replaces it. */
export const pirateModifier = (rules: Rules, pe: PublicEvents | undefined, event: VoyageEventId | null): number =>
  boss(pe) && event === 'sea-fog' ? rules.v08.events.bossPirate : rules.roles.pirate.modifier;

/** Phase II moonless night: guards do nothing and the owner's own smuggler no longer covers its ship. */
export const darkNight = (pe: PublicEvents | undefined, event: VoyageEventId | null): boolean => boss(pe) && event === 'moonless-night';

/** The black-market rush raises the smuggled goods value only in phase I (嚴查 in phase II tightens the inspection instead). */
export const rushValue = (rules: Rules, pe: PublicEvents | undefined, event: VoyageEventId | null): number =>
  event === 'black-market-rush' && !boss(pe) ? rules.voyageEvents.blackMarketRushGoodsValue : rules.roles.smuggler.goodsValue;

export const inspectionAllowance = (rules: Rules, pe: PublicEvents | undefined, event: VoyageEventId | null): number =>
  rules.v08.inspection.allowance + (boss(pe) && event === 'black-market-rush' ? rules.v08.events.bossInspectionAllowance : 0);

/** 貨滿為患 (phase II calm seas): drops move this many times as many cells. */
export const dropMultiplier = (rules: Rules, pe: PublicEvents | undefined, event: VoyageEventId | null): number =>
  boss(pe) && event === 'calm-seas' ? rules.v08.events.bossDropMultiplier : 1;

/** 黑市大開: no price can go down this round. */
export const noPriceDrop = (pe: PublicEvents | undefined): boolean => pe?.finalEffect === 'open-market';

/** 最後一搏: raw dice this round are the best of `lastGambleDice` d6 (1 = a plain die). */
export const diceToRoll = (rules: Rules, pe: PublicEvents | undefined): number => (pe?.finalEffect === 'last-gamble' ? Math.max(1, rules.v08.events.lastGambleDice) : 1);

/** §7.3 with the phase effects: drops scaled by 貨滿為患, none at all under 黑市大開. */
export function eventPriceStep(rules: Rules, pe: PublicEvents | undefined, event: VoyageEventId | null, good: GoodId, step: number, arrived: number, demand: number): number {
  const plain = nextPriceStep(rules, good, step, arrived, demand);
  if (plain >= step) return plain;
  if (noPriceDrop(pe)) return step;
  const multiplier = dropMultiplier(rules, pe, event);
  return multiplier === 1 ? plain : Math.max(0, step - (step - plain) * multiplier);
}
