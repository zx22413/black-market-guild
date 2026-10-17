import { computeResult } from '../../src/v07/game/scoring';
import { RULES_V07 } from '../../src/v07/game';
import type { BuildingId, PlayerState } from '../../src/v07/game';

export { RULES_V07 };

/** The engine's own final scoring for plain cash-and-buildings players. */
export function computeResultOf(players: readonly { id: string; cash: number; buildings: readonly BuildingId[] }[]) {
  const full = players.map((p) => ({ id: p.id, cash: p.cash, buildings: [...p.buildings] }) as unknown as PlayerState);
  return computeResult(full, RULES_V07);
}
