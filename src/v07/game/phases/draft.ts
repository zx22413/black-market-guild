import type { IslandId, MatchState, PlayerId, Step } from '../types';

/** §11.1: every player keeps the island they chose; all choices are revealed together. */
export function resolveIslandDraft(state: MatchState): Step {
  const islands: Record<PlayerId, IslandId> = {};
  const players = state.players.map((p) => {
    const action = state.roundState.submissions[p.id];
    if (action?.type !== 'choose-island') {
      throw new Error(`${p.id} has not chosen an island`);
    }
    islands[p.id] = action.island;
    return { ...p, island: action.island };
  });
  return { state: { ...state, players, islandOffers: {} }, events: [{ type: 'islands-chosen', islands }] };
}
