import { buildingValue, type BuildingId, type MatchEvent, type MatchResult, type PlayerId, type Rules } from '../../v07/game';

// The end of the match (§3, §13) as rows to reveal: rank, cash, each building at half its cash
// cost, total wealth, how a tie on wealth was broken, and the cash after every round for a small
// history line. Built from public events and the engine's result only.

export interface ResultRow {
  readonly playerId: PlayerId;
  readonly rank: number;
  readonly cash: number;
  readonly buildings: readonly { readonly id: BuildingId; readonly value: number }[];
  readonly buildingValue: number;
  readonly wealth: number;
  /**
   * 'cash': someone else has the same wealth and cash decided the order (§3);
   * 'shared': same wealth and same cash, so the rank is shared; null otherwise.
   */
  readonly tieBreak: 'cash' | 'shared' | null;
  readonly winner: boolean;
  /** Cash at the end of each round, round 1 first. */
  readonly cashByRound: readonly number[];
}

/** Buildings each player holds at the end, from the public build events. */
function heldBuildings(events: readonly MatchEvent[]): Map<PlayerId, BuildingId[]> {
  const held = new Map<PlayerId, BuildingId[]>();
  for (const e of events) {
    if (e.type !== 'buildings-built') continue;
    for (const b of e.builds) held.set(b.playerId, [...(held.get(b.playerId) ?? []), b.building]);
  }
  return held;
}

/** Cash after each round-ended, starting from `startingCash`. */
function cashHistory(events: readonly MatchEvent[], players: readonly PlayerId[], startingCash: number): Map<PlayerId, number[]> {
  const cash = new Map(players.map((id) => [id, startingCash]));
  const history = new Map(players.map((id) => [id, [] as number[]]));
  for (const e of events) {
    if (e.type === 'cash-changed') cash.set(e.playerId, (cash.get(e.playerId) ?? 0) + e.amount);
    if (e.type === 'round-ended') for (const id of players) history.get(id)!.push(cash.get(id) ?? 0);
  }
  return history;
}

export function resultRows(events: readonly MatchEvent[], result: MatchResult, startingCash: number, rules: Rules): ResultRow[] {
  const players = result.standings.map((s) => s.playerId);
  const held = heldBuildings(events);
  const history = cashHistory(events, players, startingCash);
  return [...result.standings]
    .sort((a, b) => a.rank - b.rank || b.cash - a.cash)
    .map((s) => {
      const sameWealth = result.standings.filter((o) => o.playerId !== s.playerId && o.wealth === s.wealth);
      const tieBreak = sameWealth.length === 0 ? null : sameWealth.some((o) => o.cash === s.cash) ? 'shared' : 'cash';
      return {
        playerId: s.playerId,
        rank: s.rank,
        cash: s.cash,
        buildings: (held.get(s.playerId) ?? []).map((id) => ({ id, value: buildingValue(rules, [id]) })),
        buildingValue: s.buildingValue,
        wealth: s.wealth,
        tieBreak,
        winner: result.winners.includes(s.playerId),
        cashByRound: history.get(s.playerId) ?? [],
      };
    });
}
