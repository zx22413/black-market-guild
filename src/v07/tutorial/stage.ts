import { ISLAND_IDS, type MatchEvent, type MatchState, type PrivateEvent, type Transition, type V08Card, type VoyageEventId } from '../game';
import type { RoundScript, TutorialScript } from './types';

// Fixes the tutorial's hidden draws (docs/tutorial-outline.md §9.1): only what no seat has seen
// yet is rewritten, so the table rebuilt from public events always matches the engine.

const isOpening = (t: Transition): boolean => t.state.round === 0 && t.events.some((e) => e.type === 'phase-started' && e.phase === 'island-choice');

/** The island offers: each seat's scripted island, with another island so the draft looks normal. */
function offers(script: TutorialScript): Record<string, readonly string[]> {
  return Object.fromEntries(
    script.seats.map((seat, i) => {
      const other =
        seat.offer ?? ISLAND_IDS.find((id) => id !== seat.island && !script.seats.some((s) => s.island === id || s.offer === id)) ?? ISLAND_IDS.find((id) => id !== seat.island)!;
      return [`p${i + 1}`, [seat.island, other]];
    }),
  );
}

/**
 * V0.8 event deck: the scripted cards (advance cards included) on top, keeping the deck's length (it is public), and the
 * scripted order of the tide candidates (the public 'tide-candidates' event is rewritten with it).
 */
function stageEventDeck(script: TutorialScript, state: MatchState, events: readonly MatchEvent[]): { state: MatchState; events: readonly MatchEvent[] } {
  const ev = state.v08Events;
  if (ev === undefined) return { state, events };
  const cards: V08Card[] = script.rounds.map((r) => r.event);
  const candidates = script.tideCandidates ?? ev.tideCandidates;
  return {
    state: { ...state, v08Events: { ...ev, deck: [...cards, ...ev.deck.slice(cards.length)].slice(0, ev.deck.length), tideCandidates: candidates } },
    events: events.map((e) => (e.type === 'tide-candidates' ? { ...e, candidates } : e)),
  };
}

/** Puts the scripted cards on top of each draw pile, keeping the piles' length. */
function stageOpening(script: TutorialScript, t: Transition): Transition {
  const demand = script.rounds.map((r) => r.demand);
  const events = script.rounds.flatMap((r): VoyageEventId[] => (r.event === 'advance' ? [] : [r.event]));
  const islandOffers = offers(script) as MatchState['islandOffers'];
  const staged = stageEventDeck(script, t.state, t.events);
  const { state } = staged;
  return {
    ...t,
    events: staged.events,
    state: {
      ...state,
      islandOffers,
      demandDeck: [...demand, ...state.demandDeck.slice(demand.length)],
      voyageDeck: [...events, ...state.voyageDeck.slice(events.length)],
    },
    privateEvents: t.privateEvents.map((e): PrivateEvent => (e.type === 'island-offers' ? { ...e, islands: islandOffers[e.playerId] ?? e.islands } : e)),
  };
}

/** `count` dice whose highest is `kept`: the others a little lower, the kept one last. */
export function scriptedDice(count: number, kept: number): readonly number[] {
  return [...Array.from({ length: Math.max(0, count - 1) }, (_, i) => Math.max(1, kept - 1 - i)), kept];
}

function stageRound(round: RoundScript, state: MatchState): MatchState {
  if (state.phase === 'role-deployment') {
    // The dice were rolled when the investments came in; no one has seen them yet (§4).
    // In a final market every ship throws several dice and keeps the highest: the scripted roll is the one kept, and the
    // others are made to agree with it (lower ones, the same every time), so the dice show plays what the lesson says.
    const ships = state.roundState.ships.map((s) => {
      const rawRoll = round.rolls?.[s.owner] ?? 6;
      return { ...s, rawRoll, ...(s.gambleDice === undefined ? {} : { gambleDice: scriptedDice(s.gambleDice.length, rawRoll) }) };
    });
    return { ...state, roundState: { ...state.roundState, ships } };
  }
  return state;
}

/** The runner's `stage` hook for a tutorial script. */
export function tutorialStage(script: TutorialScript): (t: Transition) => Transition {
  return (t) => {
    if (isOpening(t)) return stageOpening(script, t);
    const round = script.rounds[t.state.round - 1];
    return round ? { ...t, state: stageRound(round, t.state) } : t;
  };
}
