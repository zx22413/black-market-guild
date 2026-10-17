import { buildingValue, type BuildingId, type PlayerId, type Rules } from '../../v07/game';

// The standing of every guild during the match, the way the end of the match will score it (§13):
// cash plus half the cash cost of the buildings held; leftover goods count for nothing. Ties go
// to more cash (§3), and equal on both shares the rank.

export interface StandingInput {
  readonly id: PlayerId;
  readonly cash: number;
  readonly buildings: readonly BuildingId[];
}

export interface Standing {
  readonly id: PlayerId;
  readonly cash: number;
  readonly buildingValue: number;
  readonly wealth: number;
  /** 1 for the leader; guilds equal in wealth and cash share a rank. */
  readonly rank: number;
}

/** Richest first; equal guilds keep the order they were given. */
export function standingsOf(players: readonly StandingInput[], rules: Rules): Standing[] {
  const scored = players.map((p) => {
    const value = buildingValue(rules, p.buildings);
    return { id: p.id, cash: p.cash, buildingValue: value, wealth: p.cash + value };
  });
  const better = (a: (typeof scored)[number], b: (typeof scored)[number]) => a.wealth > b.wealth || (a.wealth === b.wealth && a.cash > b.cash);
  return scored
    .map((s, seat) => ({ ...s, seat, rank: 1 + scored.filter((o) => better(o, s)).length }))
    .sort((a, b) => a.rank - b.rank || a.seat - b.seat)
    .map(({ seat: _seat, ...s }) => s);
}
