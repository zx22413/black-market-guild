import type { MatchEvent, PlayerId, RoleId } from '../../v07/game';
import type { SessionPlayer } from '../session/gameSession';
import { buildBoard } from '../session/board';

// Pure helpers that turn a match's public events into the numbers the statistics keep.

export type MatchMode = 'local' | 'hotseat' | 'online';

/** Online when anyone sits remotely; hot-seat when several people share this device. */
export function matchMode(players: readonly SessionPlayer[]): MatchMode {
  if (players.some((p) => p.kind === 'remote')) return 'online';
  return players.filter((p) => p.kind === 'local-human').length > 1 ? 'hotseat' : 'local';
}

/** The seat the statistics follow: the first person playing on this device. */
export const statsSeat = (players: readonly SessionPlayer[]): PlayerId | null => players.find((p) => p.kind === 'local-human')?.id ?? null;

export interface RoundStat {
  readonly round: number;
  readonly cash: number;
  /** By cash at the end of the round; ties share the better rank. */
  readonly rank: number;
}

/** Cash and rank of `seat` at the end of every round so far. */
export function roundStats(events: readonly MatchEvent[], ids: readonly PlayerId[], startingCash: number, seat: PlayerId): readonly RoundStat[] {
  return events.flatMap((e, i): RoundStat[] => {
    if (e.type !== 'round-ended') return [];
    const board = buildBoard(ids, startingCash, events.slice(0, i + 1));
    const cash = board.players[seat]?.cash ?? 0;
    const rank = 1 + ids.filter((id) => (board.players[id]?.cash ?? 0) > cash).length;
    return [{ round: e.round, cash, rank }];
  });
}

/** How often `seat` deployed each role, from the role reveals. */
export function roleCounts(events: readonly MatchEvent[], seat: PlayerId): Readonly<Partial<Record<RoleId, number>>> {
  const counts: Partial<Record<RoleId, number>> = {};
  events.forEach((e) => {
    if (e.type !== 'roles-revealed') return;
    const n = e.deployments.filter((d) => d.playerId === seat).length;
    if (n > 0) counts[e.role] = (counts[e.role] ?? 0) + n;
  });
  return counts;
}

/** The round and decision phase the match was in last. */
export function whereInMatch(events: readonly MatchEvent[]): { readonly round: number; readonly phase: string } {
  let round = 0;
  let phase = 'start';
  events.forEach((e) => {
    if (e.type === 'round-started') round = e.round;
    if (e.type === 'phase-started') phase = e.phase;
    if (e.type === 'roles-revealed') phase = 'resolution';
  });
  return { round, phase };
}
