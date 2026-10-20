import { ISLAND_IDS, createRngFromState, type MatchState, type PrivateEvent, type RngState, type Transition } from '../game';
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

/** Puts the scripted cards on top of each draw pile, keeping the piles' length. */
function stageOpening(script: TutorialScript, t: Transition): Transition {
  const { state } = t;
  const demand = script.rounds.map((r) => r.demand);
  const events = script.rounds.map((r) => r.event);
  const islandOffers = offers(script) as MatchState['islandOffers'];
  return {
    ...t,
    state: {
      ...state,
      islandOffers,
      demandDeck: [...demand, ...state.demandDeck.slice(demand.length)],
      voyageDeck: [...events, ...state.voyageDeck.slice(events.length)],
    },
    privateEvents: t.privateEvents.map((e): PrivateEvent => (e.type === 'island-offers' ? { ...e, islands: islandOffers[e.playerId] ?? e.islands } : e)),
  };
}

/** The rng state whose next die is `value` (the reroll is drawn inside the transition that shows it). */
export function rngForDie(value: number, min: number, max: number): RngState {
  for (let s = 0; s < 10_000; s += 1) {
    if (createRngFromState(s).int(min, max) === value) return s;
  }
  throw new Error(`no rng state rolls ${value}`);
}

function stageRound(round: RoundScript, state: MatchState): MatchState {
  const owner = (shipId: string) => state.roundState.ships.find((s) => s.id === shipId)?.owner ?? '';
  if (state.phase === 'role-deployment') {
    // The dice were rolled when the investments came in; no one has seen them yet (§4).
    const ships = state.roundState.ships.map((s) => ({ ...s, rawRoll: round.rolls?.[s.owner] ?? 6 }));
    return { ...state, roundState: { ...state.roundState, ships } };
  }
  if (state.phase === 'intel-reroll' && round.rerolls) {
    const rerolled = state.roundState.deployments.find((d) => d.role === 'intel' && d.targetShipId !== null && round.rerolls?.[owner(d.targetShipId)] !== undefined);
    const value = rerolled?.targetShipId ? round.rerolls[owner(rerolled.targetShipId)] : undefined;
    if (value !== undefined) {
      return { ...state, rng: rngForDie(value, state.rules.sailing.dieMin, state.rules.sailing.dieMax) };
    }
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
