import type { MarketEventId, MatchEvent, RoleId, VoyageOutcome } from '../src/game';
import type { MatchLog } from '../src/match';

/** One seat of one simulated match, tagged with the strategy that played it. */
export interface SeatRecord {
  readonly strategy: string;
  readonly playerId: string;
}

type Voyage = 'joint' | 'solo' | 'stay';

export interface SimStats {
  matches: number;
  playerRounds: number;
  wins: Map<string, number>;
  seatsPlayed: Map<string, number>;
  wealth: Map<string, number[]>;
  voyages: Map<Voyage, number>;
  voyagesByMarket: Map<MarketEventId, Map<Voyage, number>>;
  ships: Map<'solo' | 'joint', Map<VoyageOutcome, number>>;
  roles: Map<string, Map<RoleId | 'none', number>>;
  guardOwnShip: number;
  guardOtherShip: number;
  betrayals: number;
  pirateDeployments: number;
  pirateSinks: number;
  pirateNet: number;
  smuggling: Map<'taken' | 'confiscated' | 'seized' | 'lost', number>;
  jointOwnerRounds: number;
  assetsHeld: Map<string, number[]>;
  purchases: Map<string, number>;
  purchaseRounds: Map<string, number[]>;
}

export function emptyStats(): SimStats {
  return {
    matches: 0,
    playerRounds: 0,
    wins: new Map(),
    seatsPlayed: new Map(),
    wealth: new Map(),
    voyages: new Map(),
    voyagesByMarket: new Map(),
    ships: new Map(),
    roles: new Map(),
    guardOwnShip: 0,
    guardOtherShip: 0,
    betrayals: 0,
    pirateDeployments: 0,
    pirateSinks: 0,
    pirateNet: 0,
    smuggling: new Map(),
    jointOwnerRounds: 0,
    assetsHeld: new Map(),
    purchases: new Map(),
    purchaseRounds: new Map(),
  };
}

function bump<K>(map: Map<K, number>, key: K, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function push<K>(map: Map<K, number[]>, key: K, value: number): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function nested<K, J>(map: Map<K, Map<J, number>>, key: K): Map<J, number> {
  const inner = map.get(key) ?? new Map<J, number>();
  map.set(key, inner);
  return inner;
}

/** Folds one match into the running statistics. */
export function addMatch(stats: SimStats, log: MatchLog, seats: readonly SeatRecord[]): void {
  const strategyOf = new Map(seats.map((s) => [s.playerId, s.strategy]));
  stats.matches += 1;
  const winnerShare = 1 / log.result.winners.length;
  for (const standing of log.result.standings) {
    const strategy = strategyOf.get(standing.playerId)!;
    bump(stats.seatsPlayed, strategy);
    push(stats.wealth, strategy, standing.wealth);
    if (standing.rank === 1) {
      bump(stats.wins, strategy, winnerShare);
    }
  }
  for (const player of log.finalState.players) {
    push(stats.assetsHeld, strategyOf.get(player.id)!, player.assets.length);
  }
  foldEvents(stats, log.events, strategyOf, deploymentsByRound(log));
}

type RoundDeployment = RoundTracker['deployments'][number];

/**
 * Deployments per round, read from the action log rather than public events, because
 * anonymous smugglers never appear in public reveals.
 */
function deploymentsByRound(log: MatchLog): Map<number, RoundDeployment[]> {
  const byRound = new Map<number, RoundDeployment[]>();
  log.actions.forEach((action, i) => {
    if (action.type === 'deploy-role' && action.role !== null && action.targetShipId !== null) {
      const round = log.actionRounds[i]!;
      byRound.set(round, [...(byRound.get(round) ?? []), { playerId: action.playerId, role: action.role, shipId: action.targetShipId }]);
    }
  });
  return byRound;
}

interface RoundTracker {
  market: MarketEventId | null;
  owners: Map<string, readonly string[]>;
  kinds: Map<string, 'solo' | 'joint'>;
  deployments: { playerId: string; role: RoleId; shipId: string }[];
}

function newRound(market: MarketEventId | null, deployments: RoundTracker['deployments'] = []): RoundTracker {
  return { market, owners: new Map(), kinds: new Map(), deployments };
}

/** Classifies each smuggled stash on a resolved ship (game-design.md §7 走私結算). */
function foldSmuggling(stats: SimStats, round: RoundTracker, shipId: string, outcome: VoyageOutcome): void {
  const on = (role: RoleId) => round.deployments.filter((d) => d.role === role && d.shipId === shipId);
  const smugglers = on('smuggler').map((d) => d.playerId);
  for (const _ of smugglers) {
    if (outcome === 'arrived') {
      const inspectors = on('guard').filter((d) => !smugglers.includes(d.playerId));
      bump(stats.smuggling, inspectors.length > 0 ? 'confiscated' : 'taken');
    } else {
      bump(stats.smuggling, on('pirate').length > 0 ? 'seized' : 'lost');
    }
  }
}

function foldRoles(stats: SimStats, round: RoundTracker, strategyOf: ReadonlyMap<string, string>): void {
  for (const [playerId, strategy] of strategyOf) {
    const d = round.deployments.find((x) => x.playerId === playerId);
    bump(nested(stats.roles, strategy), d?.role ?? 'none');
  }
  for (const d of round.deployments) {
    const own = (round.owners.get(d.shipId) ?? []).includes(d.playerId);
    if (d.role === 'guard') {
      own ? (stats.guardOwnShip += 1) : (stats.guardOtherShip += 1);
    } else if (d.role === 'pirate') {
      stats.pirateDeployments += 1;
      stats.betrayals += own ? 1 : 0;
    }
  }
}

function foldEvents(
  stats: SimStats,
  events: readonly MatchEvent[],
  strategyOf: ReadonlyMap<string, string>,
  deployments: ReadonlyMap<number, RoundTracker['deployments']>,
): void {
  let round = newRound(null);
  for (const event of events) {
    switch (event.type) {
      case 'market-event-revealed':
        round = newRound(event.event, [...(deployments.get(event.round) ?? [])]);
        break;
      case 'assets-purchased':
        event.purchases.forEach((p) => {
          bump(stats.purchases, p.asset);
          push(stats.purchaseRounds, p.asset, event.round);
        });
        break;
      case 'ships-launched': {
        const byMarket = nested(stats.voyagesByMarket, round.market!);
        for (const ship of event.ships) {
          round.owners.set(ship.id, ship.owners);
          round.kinds.set(ship.id, ship.kind);
          ship.owners.forEach(() => {
            bump(stats.voyages, ship.kind);
            bump(byMarket, ship.kind);
          });
          stats.jointOwnerRounds += ship.kind === 'joint' ? ship.owners.length : 0;
        }
        event.stayedInPort.forEach(() => {
          bump(stats.voyages, 'stay');
          bump(byMarket, 'stay');
        });
        stats.playerRounds += strategyOf.size;
        break;
      }
      case 'ship-resolved': {
        bump(nested(stats.ships, round.kinds.get(event.shipId)!), event.outcome);
        const pirates = round.deployments.filter((d) => d.role === 'pirate' && d.shipId === event.shipId);
        stats.pirateSinks += event.outcome === 'sank' ? pirates.length : 0;
        foldSmuggling(stats, round, event.shipId, event.outcome);
        break;
      }
      case 'cash-changed':
        if (event.reason === 'pirate-loot' || event.reason === 'smuggling-seized') {
          stats.pirateNet += event.amount;
        }
        break;
      case 'round-ended':
        foldRoles(stats, round, strategyOf);
        break;
      default:
        break;
    }
  }
}
