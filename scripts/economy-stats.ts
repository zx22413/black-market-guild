import { BUILDING_IDS, ECON_ROLE_IDS, MATERIALS, type EconomyMatchRun } from '../src/proto/economy';

/** Aggregated simulation statistics for the economy prototype. */
export interface EconomyStats {
  matches: number;
  seats: number;
  byStrategy: Record<string, { seats: number; wins: number; wealth: number }>;
  buildings: Record<string, { count: number; roundSum: number }>;
  roles: Record<string, number>;
  guardOthers: number;
  pirateIncome: number;
  pirateFees: number;
  pirateSinks: number;
  playerRounds: number;
  loadingRounds: number;
  unitsShipped: number;
  priceSteps: Record<string, number[]>;
  demandVsArrived: { under: number; exact: number; over: number };
  escortFees: number;
  insurance: number;
  insuredKept: number;
  commission: number;
  manipulations: number;
  betsWon: number;
  smugglerCovers: number;
  contrabandShips: number;
  coveredContrabandShips: number;
  contrabandSeizedUnits: number;
  contrabandSeizedCash: number;
  directUnits: number;
  directCash: number;
  salvaged: number;
  smuggled: number;
  unsoldUnits: number;
  unsoldByMaterial: Record<string, number>;
  wealthSpread: number;
}

export function emptyEconomyStats(steps: number): EconomyStats {
  return {
    matches: 0,
    seats: 0,
    byStrategy: {},
    buildings: Object.fromEntries(BUILDING_IDS.map((b) => [b, { count: 0, roundSum: 0 }])),
    roles: Object.fromEntries(ECON_ROLE_IDS.map((r) => [r, 0])),
    guardOthers: 0,
    pirateIncome: 0,
    pirateFees: 0,
    pirateSinks: 0,
    playerRounds: 0,
    loadingRounds: 0,
    unitsShipped: 0,
    priceSteps: Object.fromEntries(MATERIALS.map((m) => [m, Array.from({ length: steps }, () => 0)])),
    demandVsArrived: { under: 0, exact: 0, over: 0 },
    escortFees: 0,
    insurance: 0,
    insuredKept: 0,
    commission: 0,
    manipulations: 0,
    betsWon: 0,
    smugglerCovers: 0,
    contrabandShips: 0,
    coveredContrabandShips: 0,
    contrabandSeizedUnits: 0,
    contrabandSeizedCash: 0,
    directUnits: 0,
    directCash: 0,
    salvaged: 0,
    smuggled: 0,
    unsoldUnits: 0,
    unsoldByMaterial: Object.fromEntries(MATERIALS.map((m) => [m, 0])),
    wealthSpread: 0,
  };
}

/** Adds one finished match; `strategyOf` maps a player id to its bot strategy. Mutates `stats` (local accumulator). */
export function addEconomyMatch(stats: EconomyStats, run: EconomyMatchRun, strategyOf: (playerId: string) => string): void {
  const { state, events } = run;
  const result = state.result;
  if (result === null) {
    throw new Error('match did not finish');
  }
  stats.matches += 1;
  stats.seats += state.players.length;
  for (const standing of result.standings) {
    const strategy = strategyOf(standing.playerId);
    const entry = (stats.byStrategy[strategy] ??= { seats: 0, wins: 0, wealth: 0 });
    entry.seats += 1;
    entry.wealth += standing.wealth;
    entry.wins += standing.rank === 1 ? 1 / result.winners.length : 0;
  }
  const wealths = result.standings.map((s) => s.wealth);
  stats.wealthSpread += Math.max(...wealths) - Math.min(...wealths);
  stats.unsoldUnits += state.players.reduce((sum, p) => sum + MATERIALS.reduce((u, m) => u + p.stock[m], 0), 0);
  for (const m of MATERIALS) {
    stats.unsoldByMaterial[m] = (stats.unsoldByMaterial[m] ?? 0) + state.players.reduce((sum, p) => sum + p.stock[m], 0);
  }

  for (const record of state.history) {
    record.builds.forEach((b) => {
      stats.buildings[b.building]!.count += 1;
      stats.buildings[b.building]!.roundSum += record.round;
    });
    stats.playerRounds += state.players.length;
    stats.manipulations += record.manipulations.length;
    for (const ship of record.ships) {
      const owners = ship.cargo.filter((lot) => MATERIALS.some((m) => state.rules.seizable[m] === 1 && lot.goods[m] > 0)).map((lot) => lot.playerId);
      if (owners.length > 0) {
        stats.contrabandShips += 1;
        stats.coveredContrabandShips += record.deployments.some((d) => d.role === 'smuggler' && d.targetShipId === ship.id) ? 1 : 0;
      }
    }
    stats.directUnits += record.directSales.reduce((sum, lot) => sum + MATERIALS.reduce((u, m) => u + lot.goods[m], 0), 0);
    const loaders = new Set(record.ships.flatMap((s) => s.cargo.map((lot) => lot.playerId)));
    stats.loadingRounds += loaders.size;
    stats.unitsShipped += record.ships.reduce((sum, s) => sum + s.cargo.reduce((u, lot) => u + MATERIALS.reduce((x, m) => x + lot.goods[m], 0), 0), 0);
    for (const d of record.deployments) {
      stats.roles[d.role] = (stats.roles[d.role] ?? 0) + 1;
      const ship = record.ships.find((s) => s.id === d.targetShipId);
      const ownCargo = ship?.cargo.some((lot) => lot.playerId === d.playerId) ?? false;
      if (d.role === 'guard' && !ownCargo) {
        stats.guardOthers += 1;
      }
      if (d.role === 'smuggler' && ownCargo) {
        stats.smugglerCovers += 1;
      }
      if (d.role === 'pirate') {
        stats.pirateFees += state.rules.roles.pirate.fee;
        stats.pirateSinks += ship?.outcome === 'sank' ? 1 : 0;
      }
    }
    for (const m of MATERIALS.filter((x) => state.rules.demand.max[x] > 0)) {
      const steps = stats.priceSteps[m]!;
      steps[record.priceAfter[m]] = (steps[record.priceAfter[m]] ?? 0) + 1;
      const arrived = record.arrived[m];
      const demand = record.demand[m];
      stats.demandVsArrived[arrived < demand ? 'under' : arrived > demand ? 'over' : 'exact'] += 1;
    }
  }
  for (const event of events) {
    if (event.type === 'cash-changed') {
      if (event.reason === 'pirate-loot' || event.reason === 'smuggling-seized') {
        stats.pirateIncome += event.amount;
      } else if (event.reason === 'escort-fee') {
        stats.escortFees += event.amount;
      } else if (event.reason === 'insurance') {
        stats.insurance += event.amount;
      } else if (event.reason === 'broker-bet') {
        stats.betsWon += 1;
      } else if (event.reason === 'contraband-seized') {
        stats.contrabandSeizedCash += event.amount;
      } else if (event.reason === 'exchange-commission') {
        stats.commission += event.amount;
      } else if (event.reason === 'direct-sale') {
        stats.directCash += event.amount;
      }
    } else if (event.type === 'insured-goods-kept') {
      stats.insuredKept += MATERIALS.reduce((u, m) => u + event.goods[m], 0);
    } else if (event.type === 'contraband-seized') {
      stats.contrabandSeizedUnits += event.units;
    } else if (event.type === 'salvaged') {
      stats.salvaged += 1;
    } else if (event.type === 'ship-smuggled') {
      stats.smuggled += event.amount;
    }
  }
}
