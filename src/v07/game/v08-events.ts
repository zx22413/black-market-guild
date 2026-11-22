import { nextPriceStep } from './goods';
import { nextInt, shuffle, type RngState } from './rng';
import type { Rules } from './rules';
import { TIDE_KINDS, type GoodId, type LateCard, type MatchState, type PublicEvents, type TideKind, type V08Card, type V08EventsState, type VoyageEventId } from './types';

// V0.8 simulation prototype (v08.events): the event deck sets the match length and splits it into two phases; the
// regular voyage events have boss versions in phase II. NOT rules. With the switch off every helper below returns the
// V0.7.1 value, so the engine and the bots can call them unconditionally.

export const eventsOn = (rules: Rules): boolean => rules.v08.events.enabled === 1;

/**
 * The event deck: the shuffled regular voyage events, with the 1st advance at a uniformly random round in
 * firstAdvanceFrom–firstAdvanceTo and the 2nd in secondAdvanceFrom–secondAdvanceTo. Positions past the 2nd advance are
 * never drawn, so the deck stops there (or earlier if the regular cards run out).
 * v08.events.lateCards: the regular cards left after phase I's are shuffled with the late cards (黑市大開, 最後一搏), and
 * the rounds from the 1st advance on draw from that pool. v08.events.tides: two distinct candidate kinds are drawn last.
 * Each switch draws from the rng only when on, so the deck is unchanged with them off.
 */
export function buildEventDeck(
  rules: Rules,
  regular: readonly VoyageEventId[],
  rng: RngState,
): { readonly deck: V08Card[]; readonly rng: RngState; readonly tideCandidates: readonly TideKind[] } {
  const e = rules.v08.events;
  const shuffled = shuffle(regular, rng);
  const first = nextInt(shuffled.state, e.firstAdvanceFrom, e.firstAdvanceTo);
  const second = nextInt(first.state, e.secondAdvanceFrom, e.secondAdvanceTo);
  const phaseOne = shuffled.items.slice(0, Math.max(0, first.value - 1));
  const late = e.lateCards === 1 ? shuffle<V08Card>([...shuffled.items.slice(phaseOne.length), ...LATE_CARDS], second.state) : null;
  const cards: readonly V08Card[] = late === null ? shuffled.items : [...phaseOne, ...late.items];
  const deck: V08Card[] = [];
  let next = 0;
  for (let round = 1; round <= e.secondAdvanceTo; round += 1) {
    if (round === first.value || round === second.value) {
      deck.push('advance');
      continue;
    }
    const card = cards[next];
    if (card === undefined) break;
    deck.push(card);
    next += 1;
  }
  const afterDeck = late?.state ?? second.state;
  if (e.tides !== 1) return { deck, rng: afterDeck, tideCandidates: [] };
  const kinds = shuffle(TIDE_KINDS, afterDeck);
  return { deck, rng: kinds.state, tideCandidates: kinds.items.slice(0, 2) };
}

/** The late cards, one copy each (v08.events.lateCards). */
export const LATE_CARDS: readonly LateCard[] = ['open-market', 'last-gamble'];

export const isLateCard = (card: V08Card): card is LateCard => (LATE_CARDS as readonly string[]).includes(card);

export const initialEventsState = (deck: readonly V08Card[], tideCandidates: readonly TideKind[] = []): V08EventsState => ({
  deck,
  advancesDrawn: 0,
  phaseTwoFrom: null,
  finalRound: null,
  finalEffect: null,
  tideCandidates,
  tide: null,
  lateCard: null,
});

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
    tideCandidates: ev.tideCandidates,
    tide: ev.tide,
    lateCard: ev.lateCard,
    ...(state.rules.v08.events.flipOnlyTideCard === 1 ? { flipCard: flipCardFor(ev.tide) } : {}),
  };
}

/** v08.events.flipOnlyTideCard: the event card matching each tide kind (月黑風高 and 順風 never flip). */
export const TIDE_CARD: Readonly<Record<TideKind, VoyageEventId>> = { storm: 'storm', pirate: 'sea-fog', inspection: 'black-market-rush', crash: 'calm-seas' };

/** The card that may show its boss side once `tide` is revealed (null before). */
export const flipCardFor = (tide: TideKind | null): VoyageEventId | null => (tide === null ? null : TIDE_CARD[tide]);

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

/**
 * Whether `event` shows its phase II (boss) side: every card in phase II, or with v08.events.flipOnlyTideCard only the
 * card matching the revealed tide (PublicEvents.flipCard).
 */
export const bossSide = (pe: PublicEvents | undefined, event: VoyageEventId | null): boolean =>
  pe?.phase === 2 && (pe.flipCard === undefined || (event !== null && pe.flipCard === event));
const boss = bossSide;

/** v08.events.tides: the tide acting this round (phase II rounds and the final round, once picked), else null. */
export const activeTide = (pe: PublicEvents | undefined): TideKind | null => (pe?.phase === 2 ? pe.tide : null);

/**
 * v08.islands.lighthouseFades: an island's own-ship modifier (the lighthouse's +1) in this round, 0 once phase II has
 * begun. `nextRound` asks about next round instead (a freighter resolving then).
 */
export function ownShipShift(rules: Rules, base: number, pe: PublicEvents | undefined, nextRound = false): number {
  return islandFaded(rules, pe, nextRound) ? 0 : base;
}

/** v08.islands.ownShipMinRaw: whether the island's own-ship modifier applies to a voyage with this raw die. */
export function ownShipApplies(rules: Rules, raw: number): boolean {
  return raw >= rules.v08.islands.ownShipMinRaw;
}

/** v08.islands.lighthouseBeacon: the extra modifier each pirate adds against a ship whose owner is on the lighthouse. */
export function beaconShift(rules: Rules, ownerIsland: string | null): number {
  return ownerIsland === 'lighthouse' ? rules.v08.islands.lighthouseBeacon : 0;
}

/** v08.islands.lighthouseFades: whether island own-ship effects (modifier and final cap) are off this round (or next). */
export function islandFaded(rules: Rules, pe: PublicEvents | undefined, nextRound = false): boolean {
  if (rules.v08.islands.lighthouseFades !== 1 || pe === undefined) return false;
  return pe.phase === 2 || (nextRound && pe.darkTide);
}

/** The tide that will act next round: the picked one from 暗潮將至 on (for ships that resolve next round). */
export const nextRoundTide = (pe: PublicEvents | undefined): TideKind | null => (pe !== undefined && (pe.phase === 2 || pe.darkTide) ? pe.tide : null);

/** 風暴潮: every ship's modifier this round (0 without it). */
export const tideShift = (rules: Rules, tide: TideKind | null): number => (tide === 'storm' ? rules.v08.events.tideStorm : 0);

/** 風暴潮 (tideStormExtraLoss): whether the storm tide's extra crate loss acts this round. */
export const stormTideLossActs = (rules: Rules, tide: TideKind | null): boolean => tide === 'storm' && rules.v08.events.tideStormExtraLoss > 0;

/**
 * 海盜潮 (tidePirateArrivalLoot) and the armory (v08.armory.halveAllLoot): the percent pirates take of an arriving ship's
 * income at a final whose normal loot percent is `normal`, and whether the owner's armory halves it.
 */
export function arrivalLoot(
  rules: Rules,
  tide: TideKind | null,
  normal: number,
  ownerArmory: boolean,
): { readonly percent: number; readonly crates: number; readonly fromTide: boolean; readonly halved: boolean; readonly shielded: boolean } {
  const { tidePirateArrivalLoot, tidePirateArrivalCrates } = rules.v08.events;
  const tideActs = normal === 0 && tide === 'pirate' && (tidePirateArrivalLoot > 0 || tidePirateArrivalCrates > 0);
  // v08.armory.immunePirateTide: the owner's armory shields its ships from the tide's arrival loot.
  const shielded = tideActs && ownerArmory && rules.v08.armory.immunePirateTide === 1;
  const fromTide = tideActs && !shielded;
  // v08.events.tidePirateArrivalCrates: the tide takes crates instead of a percent.
  const crates = fromTide ? tidePirateArrivalCrates : 0;
  return { percent: fromTide ? (crates > 0 ? 0 : tidePirateArrivalLoot) : normal, crates, fromTide, halved: ownerArmory && rules.v08.armory.halveAllLoot === 1, shielded };
}

/** 海盜潮: added to each pirate's modifier. */
export const tidePirateShift = (rules: Rules, tide: TideKind | null): number => (tide === 'pirate' ? rules.v08.events.tidePirate : 0);

/** 查緝潮: added to the arms inspection allowance. */
export const tideInspectionShift = (rules: Rules, tide: TideKind | null): number => (tide === 'inspection' ? rules.v08.events.tideInspection : 0);

/** v08.tradehouse.immuneCrashTide: whether the crash tide multiplies drops this round and the tradehouse shield acts. */
export const crashShieldActs = (rules: Rules, pe: PublicEvents | undefined): boolean =>
  rules.v08.tradehouse.immuneCrashTide === 1 && tideDropMultiplier(rules, activeTide(pe)) !== 1 && !noPriceDrop(pe);

/** 崩盤潮: drops move this many times as many cells. */
export const tideDropMultiplier = (rules: Rules, tide: TideKind | null): number => (tide === 'crash' ? rules.v08.events.tideDropMultiplier : 1);

/** The unconditional part of a voyage event's modifier (tailwind, storm); phase II doubles them by default. */
export function eventShift(rules: Rules, pe: PublicEvents | undefined, event: VoyageEventId | null): number {
  const v = rules.voyageEvents;
  if (event === 'tailwind') return boss(pe, event) ? rules.v08.events.bossTailwind : v.tailwind;
  if (event === 'storm') return boss(pe, event) ? rules.v08.events.bossStorm : v.storm;
  return 0;
}

/** Sea fog: pirate-targeted ships +1 in phase I; nothing in phase II (海盜伏擊 changes the pirate modifier instead). */
export const seaFogShift = (rules: Rules, pe: PublicEvents | undefined): number => (boss(pe, 'sea-fog') ? 0 : rules.voyageEvents.seaFog);

/** Moonless night: guard-targeted ships −1 in phase I; nothing in phase II (the guard is void instead). */
export const moonlessShift = (rules: Rules, pe: PublicEvents | undefined): number => (boss(pe, 'moonless-night') ? 0 : rules.voyageEvents.moonlessNight);

/** Each pirate's base modifier (before its island): 海盜伏擊 in phase II replaces it. */
export const pirateModifier = (rules: Rules, pe: PublicEvents | undefined, event: VoyageEventId | null): number =>
  (boss(pe, event) && event === 'sea-fog' ? rules.v08.events.bossPirate : rules.roles.pirate.modifier) + tidePirateShift(rules, activeTide(pe));

/** Phase II moonless night: guards do nothing and the owner's own smuggler no longer covers its ship. */
export const darkNight = (pe: PublicEvents | undefined, event: VoyageEventId | null): boolean => boss(pe, event) && event === 'moonless-night';

/** The black-market rush raises the smuggled goods value only in phase I (嚴查 in phase II tightens the inspection instead). */
export const rushValue = (rules: Rules, pe: PublicEvents | undefined, event: VoyageEventId | null): number =>
  event === 'black-market-rush' && !boss(pe, event) ? rules.voyageEvents.blackMarketRushGoodsValue : rules.roles.smuggler.goodsValue;

export const inspectionAllowance = (rules: Rules, pe: PublicEvents | undefined, event: VoyageEventId | null): number =>
  rules.v08.inspection.allowance + (boss(pe, event) && event === 'black-market-rush' ? rules.v08.events.bossInspectionAllowance : 0) + tideInspectionShift(rules, activeTide(pe));

/** 貨滿為患 (phase II calm seas): drops move this many times as many cells; 崩盤潮 multiplies it again. */
export const dropMultiplier = (rules: Rules, pe: PublicEvents | undefined, event: VoyageEventId | null): number =>
  (boss(pe, event) && event === 'calm-seas' ? rules.v08.events.bossDropMultiplier : 1) * tideDropMultiplier(rules, activeTide(pe));

/** 黑市大開 (the final effect, the late card or 最後的大市集): no price can go down this round. */
export const noPriceDrop = (pe: PublicEvents | undefined): boolean =>
  pe?.finalEffect === 'open-market' || pe?.finalEffect === 'final-market' || pe?.lateCard === 'open-market';

/** 最後一搏 (the final effect, the late card or 最後的大市集): raw dice this round are the best of `lastGambleDice` d6 (1 = a plain die). */
export const diceToRoll = (rules: Rules, pe: PublicEvents | undefined): number =>
  pe?.finalEffect === 'last-gamble' || pe?.finalEffect === 'final-market' || pe?.lateCard === 'last-gamble' ? Math.max(1, rules.v08.events.lastGambleDice) : 1;

/**
 * §7.3 with the phase effects: drops scaled by 貨滿為患, none at all under 黑市大開. `withoutTide`: leave 崩盤潮's
 * multiplier out (v08.tradehouse.immuneCrashTide: the price the tradehouse owner's own crates sell at).
 */
export function eventPriceStep(
  rules: Rules,
  pe: PublicEvents | undefined,
  event: VoyageEventId | null,
  good: GoodId,
  step: number,
  arrived: number,
  demand: number,
  withoutTide = false,
): number {
  const plain = nextPriceStep(rules, good, step, arrived, demand);
  if (plain >= step) return plain;
  if (noPriceDrop(pe)) return step;
  const multiplier = dropMultiplier(rules, pe, event) / (withoutTide ? tideDropMultiplier(rules, activeTide(pe)) : 1);
  return multiplier === 1 ? plain : Math.max(0, step - (step - plain) * multiplier);
}
