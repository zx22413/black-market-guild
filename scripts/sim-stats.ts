import { BUILDING_IDS, GOODS, ROLE_IDS, roleFee, type Goods, type PlayerId, type ShipId } from '../src/v07/game';
import type { MatchLog } from '../src/v07/match';

/** Wins, seats and wealth of one strategy or island. */
export interface Tally {
  seats: number;
  wins: number;
  wealth: number;
}

/** Aggregated V0.7 simulation statistics, built from match logs (public events and final state). */
export interface SimStats {
  matches: number;
  seats: number;
  playerRounds: number;
  byStrategy: Record<string, Tally>;
  byIsland: Record<string, Tally>;
  wealthSpread: number;
  buildings: Record<string, { count: number; roundSum: number }>;
  ships: number;
  shipsArrived: number;
  unitsShipped: number;
  armsShipped: number;
  demandVsArrived: { under: number; exact: number; over: number };
  priceSteps: Record<string, number[]>;
  unsoldUnits: number;
  unsoldByGood: Record<string, number>;
  roles: Record<string, number>;
  guardOthers: number;
  smugglerCovers: number;
  armsShips: number;
  coveredArmsShips: number;
  pirateIncome: number;
  pirateFees: number;
  pirateSinks: number;
  escortFees: number;
  insuredKept: number;
  salvaged: number;
  smuggled: number;
  smugglersCaught: number;
  commission: number;
  betsWon: number;
  armsConfiscatedUnits: number;
  armsConfiscatedCash: number;
  intelRerolls: number;
}

const units = (goods: Goods) => GOODS.reduce((sum, g) => sum + goods[g], 0);
const tally = (): Tally => ({ seats: 0, wins: 0, wealth: 0 });

export function emptyStats(steps: number): SimStats {
  return {
    matches: 0,
    seats: 0,
    playerRounds: 0,
    byStrategy: {},
    byIsland: {},
    wealthSpread: 0,
    buildings: Object.fromEntries(BUILDING_IDS.map((b) => [b, { count: 0, roundSum: 0 }])),
    ships: 0,
    shipsArrived: 0,
    unitsShipped: 0,
    armsShipped: 0,
    demandVsArrived: { under: 0, exact: 0, over: 0 },
    priceSteps: Object.fromEntries(GOODS.map((g) => [g, Array.from({ length: steps }, () => 0)])),
    unsoldUnits: 0,
    unsoldByGood: Object.fromEntries(GOODS.map((g) => [g, 0])),
    roles: Object.fromEntries(ROLE_IDS.map((r) => [r, 0])),
    guardOthers: 0,
    smugglerCovers: 0,
    armsShips: 0,
    coveredArmsShips: 0,
    pirateIncome: 0,
    pirateFees: 0,
    pirateSinks: 0,
    escortFees: 0,
    insuredKept: 0,
    salvaged: 0,
    smuggled: 0,
    smugglersCaught: 0,
    commission: 0,
    betsWon: 0,
    armsConfiscatedUnits: 0,
    armsConfiscatedCash: 0,
    intelRerolls: 0,
  };
}

function addStandings(stats: SimStats, log: MatchLog, strategyOf: (playerId: PlayerId) => string): void {
  const { result, finalState } = log;
  for (const standing of result.standings) {
    const win = standing.rank === 1 ? 1 / result.winners.length : 0;
    const island = finalState.players.find((p) => p.id === standing.playerId)?.island ?? 'none';
    for (const entry of [(stats.byStrategy[strategyOf(standing.playerId)] ??= tally()), (stats.byIsland[island] ??= tally())]) {
      entry.seats += 1;
      entry.wins += win;
      entry.wealth += standing.wealth;
    }
  }
  const wealths = result.standings.map((s) => s.wealth);
  stats.wealthSpread += Math.max(...wealths) - Math.min(...wealths);
  for (const player of finalState.players) {
    stats.unsoldUnits += units(player.stock);
    GOODS.forEach((g) => (stats.unsoldByGood[g] = (stats.unsoldByGood[g] ?? 0) + player.stock[g]));
  }
}

/** Adds one finished match; `strategyOf` maps a player id to its bot strategy. Mutates `stats` (local accumulator). */
export function addMatch(stats: SimStats, log: MatchLog, strategyOf: (playerId: PlayerId) => string): void {
  const { finalState } = log;
  const { rules } = finalState;
  stats.matches += 1;
  stats.seats += finalState.players.length;
  stats.playerRounds += finalState.players.length * rules.rounds;
  addStandings(stats, log, strategyOf);

  const owners = new Map<ShipId, PlayerId>();
  const cargo = new Map<ShipId, Goods>();
  const sank = new Set<ShipId>();
  const smuggled = new Set<ShipId>();
  for (const event of log.events) {
    switch (event.type) {
      case 'buildings-built':
        event.builds.forEach((b) => {
          stats.buildings[b.building]!.count += 1;
          stats.buildings[b.building]!.roundSum += event.round;
        });
        break;
      case 'ships-launched':
        event.ships.forEach((s) => owners.set(s.id, s.owner));
        break;
      case 'ship-resolved':
        cargo.set(event.shipId, event.cargo);
        if (event.outcome === 'sank') {
          sank.add(event.shipId);
        }
        break;
      case 'roles-revealed':
        stats.intelRerolls += event.rerolledShipIds.length;
        for (const d of event.deployments) {
          stats.roles[d.role] = (stats.roles[d.role] ?? 0) + 1;
          const own = d.targetShipId !== null && owners.get(d.targetShipId) === d.playerId;
          stats.guardOthers += d.role === 'guard' && !own ? 1 : 0;
          stats.smugglerCovers += d.role === 'smuggler' && own ? 1 : 0;
          if (d.role === 'smuggler' && d.targetShipId !== null) {
            smuggled.add(d.targetShipId);
          }
        }
        break;
      case 'market-settled':
        for (const g of GOODS) {
          const steps = stats.priceSteps[g]!;
          steps[event.priceAfter[g]] = (steps[event.priceAfter[g]] ?? 0) + 1;
          const arrived = event.arrived[g];
          const demand = event.demand[g];
          stats.demandVsArrived[arrived < demand ? 'under' : arrived > demand ? 'over' : 'exact'] += 1;
        }
        break;
      case 'arms-confiscated':
        stats.armsConfiscatedUnits += event.units;
        break;
      case 'smuggling-settled':
        stats.smugglersCaught += event.result === 'caught' ? event.smugglers.length : 0;
        break;
      case 'goods-kept':
        stats.insuredKept += units(event.goods);
        break;
      case 'goods-salvaged':
        stats.salvaged += 1;
        break;
      case 'cash-changed':
        addCash(stats, event.reason, event.amount);
        break;
      default:
        break;
    }
  }
  addShips(stats, log, cargo, sank, smuggled);
}

function addCash(stats: SimStats, reason: string, amount: number): void {
  if (reason === 'pirate-loot' || reason === 'smuggling-seized') {
    stats.pirateIncome += amount;
  } else if (reason === 'escort-fee') {
    stats.escortFees += amount;
  } else if (reason === 'broker-bet') {
    stats.betsWon += 1;
  } else if (reason === 'arms-confiscated') {
    stats.armsConfiscatedCash += amount;
  } else if (reason === 'exchange-commission') {
    stats.commission += amount;
  } else if (reason === 'smuggling' && amount > 0) {
    stats.smuggled += amount;
  }
}

function addShips(
  stats: SimStats,
  log: MatchLog,
  cargo: ReadonlyMap<ShipId, Goods>,
  sank: ReadonlySet<ShipId>,
  smuggled: ReadonlySet<ShipId>,
): void {
  for (const [shipId, goods] of cargo) {
    stats.ships += 1;
    stats.shipsArrived += sank.has(shipId) ? 0 : 1;
    stats.unitsShipped += units(goods);
    stats.armsShipped += goods.arms;
    if (goods.arms > 0) {
      stats.armsShips += 1;
      stats.coveredArmsShips += smuggled.has(shipId) ? 1 : 0;
    }
  }
  const { rules } = log.finalState;
  for (const event of log.events) {
    if (event.type !== 'roles-revealed' || event.role !== 'pirate') {
      continue;
    }
    for (const d of event.deployments) {
      const island = log.finalState.players.find((p) => p.id === d.playerId)?.island ?? null;
      stats.pirateFees += roleFee(rules, island, 'pirate');
      stats.pirateSinks += d.targetShipId !== null && sank.has(d.targetShipId) ? 1 : 0;
    }
  }
}
