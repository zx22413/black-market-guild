import type { Deployment, MatchEvent, PlayerId, RoleId, ShipId } from '../../v07/game';

// What each deployed role came to, as a stamp on its badge (the V0.6 "查獲" stamp, for every role):
// the smuggler is 查獲／得手／被劫／沉沒, the guard 沒收軍火／護航成功／沒護住, the pirate 劫得／落空,
// the broker 押中／落空. Built only from the round's public events.

export interface RoleResult {
  readonly text: string;
  /** `up` is a good result for the one who sent the role, `down` a bad one. */
  readonly tone: 'up' | 'down';
  /** A ship's role is known once that ship has been resolved; the broker's once the market has. */
  readonly shipId: ShipId | null;
}

/** Key of a deployment in the result map: one role per player per round. */
export const roleKey = (d: Pick<Deployment, 'playerId' | 'role'>): string => `${d.playerId}-${d.role}`;

type Of<T extends MatchEvent['type']> = Extract<MatchEvent, { type: T }>;

export function roleResults(events: readonly MatchEvent[], round: number): Map<string, RoleResult> {
  const inRound = events.filter((e) => !('round' in e) || e.round === round);
  const of = <T extends MatchEvent['type']>(type: T) => inRound.filter((e): e is Of<T> => e.type === type);
  const deployments = of('roles-revealed').flatMap((e) => e.deployments);
  const outcome = new Map(of('ship-resolved').map((e) => [e.shipId, e.outcome] as const));
  const smuggling = new Map(of('smuggling-settled').map((e) => [e.shipId, e]));
  const confiscated = new Map(of('arms-confiscated').map((e) => [e.shipId, e]));
  const paid = (reason: string, playerId: PlayerId, shipId: ShipId | null) =>
    of('cash-changed').some((e) => e.reason === reason && e.playerId === playerId && e.shipId === shipId && e.amount > 0);

  const results = new Map<string, RoleResult>();
  for (const d of deployments) {
    const result = resultOf(d.role, d, { outcome, smuggling, confiscated, paid });
    if (result) results.set(roleKey(d), result);
  }
  return results;
}

interface Facts {
  readonly outcome: ReadonlyMap<ShipId, 'arrived' | 'sank'>;
  readonly smuggling: ReadonlyMap<ShipId, Of<'smuggling-settled'>>;
  readonly confiscated: ReadonlyMap<ShipId, Of<'arms-confiscated'>>;
  readonly paid: (reason: string, playerId: PlayerId, shipId: ShipId | null) => boolean;
}

function resultOf(role: RoleId, d: Deployment, facts: Facts): RoleResult | null {
  const shipId = d.targetShipId;
  const stamp = (text: string, tone: 'up' | 'down'): RoleResult => ({ text, tone, shipId });
  const sank = shipId !== null && facts.outcome.get(shipId) === 'sank';
  const known = shipId !== null && facts.outcome.has(shipId);
  switch (role) {
    case 'broker':
      return { text: facts.paid('broker-bet', d.playerId, null) ? '押中' : '落空', tone: facts.paid('broker-bet', d.playerId, null) ? 'up' : 'down', shipId: null };
    case 'smuggler': {
      const settled = shipId === null ? undefined : facts.smuggling.get(shipId);
      if (settled && settled.smugglers.includes(d.playerId)) {
        return { taken: stamp('得手', 'up'), caught: stamp('查獲', 'down'), seized: stamp('被劫', 'down'), lost: stamp('沉沒', 'down') }[settled.result];
      }
      // Covering one's own arms: no one to take from, so it is about whether the cargo got through.
      return !known ? null : sank ? stamp('沉沒', 'down') : stamp('掩護', 'up');
    }
    case 'guard':
      if (shipId !== null && facts.confiscated.get(shipId)?.guards.includes(d.playerId)) return stamp('沒收軍火', 'up');
      if (shipId !== null && facts.paid('escort-fee', d.playerId, shipId)) return stamp('護航成功', 'up');
      return !known ? null : sank ? stamp('沒護住', 'down') : stamp('護住', 'up');
    case 'pirate':
      return !known ? null : sank ? stamp('劫得', 'up') : stamp('落空', 'down');
    case 'intel':
      return null;
  }
}
