import { BUILDING_IDS, GOODS, ROLE_IDS, roleFee, v08On, type Goods, type MatchEvent, type PlayerId, type ShipId } from '../src/v07/game';
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
  /** Rounds played, summed over the matches. */
  rounds: number;
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
  armsShips: number;
  coveredArmsShips: number;
  pirateIncome: number;
  pirateFees: number;
  pirateSinks: number;
  insurancePaid: number;
  salvaged: number;
  smuggled: number;
  smugglersCaught: number;
  commission: number;
  diplomatTake: number;
  smugglerCovers: number;
  /** Experiment (rules.ships): per ship type, how often it sailed, sank, and what its owners were paid for cargo (sale). */
  shipTypes: Record<string, { count: number; sank: number; sales: number; units: number }>;
  armsConfiscatedUnits: number;
  armsConfiscatedCash: number;
  /** V0.8 prototype (rules.v08): only filled when a v08 switch is on. */
  v08: V08Stats;
}

/** V0.8 prototype statistics, from public events only. */
export interface V08Stats {
  /** Per ship type: crates loaded (regular + private), crates lost on arrival, raised launches. */
  crates: Record<string, { loaded: number; privateLoaded: number; lost: number; raised: number }>;
  /** Per strategy, per ship type: launches. */
  typeByStrategy: Record<string, Record<string, number>>;
  /** Per strategy, per material action (e.g. open:standard, upgrade:hidden, build:armory): count and sum of rounds. */
  materials: Record<string, Record<string, { count: number; roundSum: number }>>;
  /** Per effect: triggers, crates involved and G (gained, or denied for the armory). */
  effects: Record<string, { count: number; crates: number; value: number }>;
  /** Per good: how often the price went up, stayed, went down. */
  priceMoves: Record<string, { up: number; flat: number; down: number }>;
  /** v08.events: matches by length, phase II rounds, final effects, units lost to 暗潮將至, boss events fired. */
  events: V08EventStats;
}

export interface V08EventStats {
  lengths: Record<number, number>;
  /** Phase II rounds per match (from the round after 暗潮將至 through the last round, final round included). */
  phaseTwo: Record<number, number>;
  /** Phase II rounds before the final round (the ones with a boss event card). */
  bossRounds: number;
  finalEffects: Record<string, number>;
  darkTideLost: Record<string, number>;
  darkTideRounds: Record<number, number>;
  finalRounds: Record<number, number>;
  boss: Record<string, number>;
  /** v08.events.lateCards: late cards drawn, by card. */
  lateCards: Record<string, number>;
  /** v08.events.tides: per picked tide kind. */
  tides: Record<string, TideStats>;
  /** v08.events.tides: per tide answer, the betting groups (matches where its tide kind was a candidate). */
  bets: Record<string, BetStats>;
  /** Seats that took the revealed tide's answer before the reveal, and every other seat (matches with a tide). */
  betRight: { seats: number; wins: number };
  betOthers: { seats: number; wins: number };
}

/** The tide kind each answer meets. */
export const ANSWER_TIDE: Readonly<Record<string, string>> = { 'build:repairyard': 'storm', 'build:armory': 'pirate', 'open:hidden': 'inspection', 'build:tradehouse': 'crash' };

/**
 * One answer's seats in the matches where its tide kind was one of the two candidates: taken before the reveal and the
 * tide matched (right) or not (wrong), taken from the reveal round on with the tide matching or not, never taken.
 */
export interface BetStats {
  right: { seats: number; wins: number };
  wrong: { seats: number; wins: number };
  afterMatch: { seats: number; wins: number };
  afterOther: { seats: number; wins: number };
  never: { seats: number; wins: number };
}

/** The four tide answers: a building, or (查緝潮) the hidden-ship skill / the owner's smuggler covering its own ship. */
export const TIDE_ANSWERS = ['build:repairyard', 'build:armory', 'open:hidden', 'build:tradehouse'] as const;

/** One tide kind's matches: answers adopted per seat, their wins, timing, and effect triggers by phase. */
export interface TideStats {
  matches: number;
  seats: number;
  phaseOneRounds: number;
  phaseTwoRounds: number;
  /** Per answer: seats that took it, their wins, and how many took it before / from the reveal round. */
  answers: Record<string, { seats: number; wins: number; before: number; after: number }>;
  /** 查緝潮's other answer: seats whose smuggler covered their own ship in phase II, and their wins. */
  coverSeats: number;
  coverWins: number;
  /** Own-ship smuggler covers in phase I / phase II rounds. */
  covers: { one: number; two: number };
  /** Per effect: triggers in phase I / phase II rounds. */
  triggers: Record<string, { one: number; two: number }>;
}

const units = (goods: Goods) => GOODS.reduce((sum, g) => sum + goods[g], 0);
const tally = (): Tally => ({ seats: 0, wins: 0, wealth: 0 });

export function emptyStats(steps: number): SimStats {
  return {
    matches: 0,
    seats: 0,
    rounds: 0,
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
    armsShips: 0,
    coveredArmsShips: 0,
    pirateIncome: 0,
    pirateFees: 0,
    pirateSinks: 0,
    insurancePaid: 0,
    salvaged: 0,
    smuggled: 0,
    smugglersCaught: 0,
    commission: 0,
    diplomatTake: 0,
    smugglerCovers: 0,
    shipTypes: {},
    armsConfiscatedUnits: 0,
    armsConfiscatedCash: 0,
    v08: { crates: {}, typeByStrategy: {}, materials: {}, effects: {}, priceMoves: Object.fromEntries(GOODS.map((g) => [g, { up: 0, flat: 0, down: 0 }])),
      events: { lengths: {}, phaseTwo: {}, bossRounds: 0, finalEffects: {}, darkTideLost: Object.fromEntries(GOODS.map((g) => [g, 0])), darkTideRounds: {}, finalRounds: {}, boss: {}, lateCards: {}, tides: {}, bets: {}, betRight: { seats: 0, wins: 0 }, betOthers: { seats: 0, wins: 0 } },
    },
  };
}

/** V0.8 prototype: material actions, crates, effects and price moves. Mutates `stats` (local accumulator). */
function addV08Event(stats: SimStats, event: MatchEvent, strategyOf: (playerId: PlayerId) => string, typeOf: ReadonlyMap<ShipId, string>): void {
  const v = stats.v08;
  const crates = (type: string) => (v.crates[type] ??= { loaded: 0, privateLoaded: 0, lost: 0, raised: 0 });
  switch (event.type) {
    case 'materials-used':
      for (const use of event.uses) {
        const key = use.material.kind === 'build' ? `build:${use.material.building}` : `${use.material.kind}:${use.material.ship}`;
        const byKey = (v.materials[strategyOf(use.playerId)] ??= {});
        const entry = (byKey[key] ??= { count: 0, roundSum: 0 });
        entry.count += 1;
        entry.roundSum += event.round;
      }
      break;
    case 'ships-launched':
      for (const ship of event.ships) {
        const byType = (v.typeByStrategy[strategyOf(ship.owner)] ??= {});
        byType[ship.type] = (byType[ship.type] ?? 0) + 1;
        crates(ship.type).raised += ship.raised === true ? 1 : 0;
      }
      break;
    case 'ship-resolved': {
      const entry = crates(typeOf.get(event.shipId) ?? 'standard');
      entry.loaded += units(event.cargo);
      entry.privateLoaded += event.privateCargo === undefined ? 0 : units(event.privateCargo);
      entry.lost += event.lost === undefined ? 0 : units(event.lost);
      break;
    }
    case 'v08-effect': {
      const entry = (v.effects[event.effect] ??= { count: 0, crates: 0, value: 0 });
      entry.count += 1;
      entry.crates += event.crates;
      entry.value += event.value;
      break;
    }
    case 'final-round':
      v.events.finalEffects[event.effect ?? 'none'] = (v.events.finalEffects[event.effect ?? 'none'] ?? 0) + 1;
      v.events.finalRounds[event.round] = (v.events.finalRounds[event.round] ?? 0) + 1;
      break;
    case 'dark-tide-rising':
      v.events.darkTideRounds[event.round] = (v.events.darkTideRounds[event.round] ?? 0) + 1;
      break;
    case 'boss-event':
      v.events.boss[event.event] = (v.events.boss[event.event] ?? 0) + 1;
      v.events.bossRounds += 1;
      break;
    case 'late-card':
      v.events.lateCards[event.card] = (v.events.lateCards[event.card] ?? 0) + 1;
      break;
    case 'dark-tide-loss':
      for (const goods of Object.values(event.lost)) GOODS.forEach((g) => (v.events.darkTideLost[g] = (v.events.darkTideLost[g] ?? 0) + goods[g]));
      break;
    case 'market-settled':
      for (const g of GOODS) {
        const move = v.priceMoves[g]!;
        const d = event.priceAfter[g] - event.priceBefore[g];
        if (d > 0) move.up += 1;
        else if (d < 0) move.down += 1;
        else move.flat += 1;
      }
      break;
    default:
      break;
  }
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
  // V0.8 prototype (v08.events): matches vary in length; otherwise finalState.round is rules.rounds.
  stats.rounds += finalState.round;
  stats.playerRounds += finalState.players.length * finalState.round;
  if (finalState.v08Events !== undefined) {
    const e = stats.v08.events;
    e.lengths[finalState.round] = (e.lengths[finalState.round] ?? 0) + 1;
    const from = finalState.v08Events.phaseTwoFrom;
    const phaseTwo = from === null ? 0 : Math.max(0, finalState.round - from + 1);
    e.phaseTwo[phaseTwo] = (e.phaseTwo[phaseTwo] ?? 0) + 1;
  }
  addStandings(stats, log, strategyOf);
  addTide(stats, log);

  const owners = new Map<ShipId, PlayerId>();
  const cargo = new Map<ShipId, Goods>();
  const sank = new Set<ShipId>();
  const smuggled = new Set<ShipId>();
  const typeOf = new Map<ShipId, string>();
  const v08 = v08On(rules);
  for (const event of log.events) {
    if (v08) {
      if (event.type === 'ships-launched') event.ships.forEach((s) => typeOf.set(s.id, s.type));
      addV08Event(stats, event, strategyOf, typeOf);
    }
    switch (event.type) {
      case 'buildings-built':
        event.builds.forEach((b) => {
          stats.buildings[b.building]!.count += 1;
          stats.buildings[b.building]!.roundSum += event.round;
        });
        break;
      case 'ships-launched':
        event.ships.forEach((s) => {
          owners.set(s.id, s.owner);
          typeOf.set(s.id, s.type);
          const entry = (stats.shipTypes[s.type] ??= { count: 0, sank: 0, sales: 0, units: 0 });
          entry.count += 1;
        });
        break;
      case 'ship-resolved':
        cargo.set(event.shipId, event.cargo);
        {
          const entry = stats.shipTypes[typeOf.get(event.shipId) ?? 'standard'];
          if (entry) entry.units += GOODS.reduce((n, g) => n + event.cargo[g], 0);
        }
        if (event.outcome === 'sank') {
          sank.add(event.shipId);
          const entry = stats.shipTypes[typeOf.get(event.shipId) ?? 'standard'];
          if (entry) entry.sank += 1;
        }
        break;
      case 'roles-revealed':
        for (const d of event.deployments) {
          stats.roles[d.role] = (stats.roles[d.role] ?? 0) + 1;
          const own = d.targetShipId !== null && owners.get(d.targetShipId) === d.playerId;
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
      case 'goods-confiscated':
        stats.armsConfiscatedUnits += event.units;
        break;
      case 'smuggling-settled':
        stats.smugglersCaught += event.result === 'caught' ? event.smugglers.length : 0;
        break;
      case 'goods-salvaged':
        stats.salvaged += 1;
        break;
      case 'cash-changed':
        addCash(stats, event.reason, event.amount);
        if (event.reason === 'sale' && event.shipId !== null) {
          const entry = stats.shipTypes[typeOf.get(event.shipId) ?? 'standard'];
          if (entry) entry.sales += event.amount;
        }
        break;
      default:
        break;
    }
  }
  addShips(stats, log, cargo, sank, smuggled);
}

const emptyTide = (): TideStats => ({
  matches: 0,
  seats: 0,
  phaseOneRounds: 0,
  phaseTwoRounds: 0,
  answers: Object.fromEntries(TIDE_ANSWERS.map((a) => [a, { seats: 0, wins: 0, before: 0, after: 0 }])),
  coverSeats: 0,
  coverWins: 0,
  covers: { one: 0, two: 0 },
  triggers: {},
});

/**
 * V0.8 prototype (v08.events.tides): per picked tide kind, which seats took each answer (and when, against the reveal
 * round), how they did, and the effects' triggers in phase I and phase II rounds. Mutates `stats` (local accumulator).
 */
function addTide(stats: SimStats, log: MatchLog): void {
  const ev = log.finalState.v08Events;
  if (ev === undefined || ev.tide === null || ev.phaseTwoFrom === null) return;
  const t = (stats.v08.events.tides[ev.tide] ??= emptyTide());
  const reveal = ev.phaseTwoFrom - 1;
  t.matches += 1;
  t.seats += log.finalState.players.length;
  t.phaseOneRounds += reveal;
  t.phaseTwoRounds += Math.max(0, log.finalState.round - reveal);
  const win = (id: PlayerId) => {
    const standing = log.result.standings.find((st) => st.playerId === id);
    return standing?.rank === 1 ? 1 / log.result.winners.length : 0;
  };
  const owners = new Map<ShipId, PlayerId>();
  const took = new Map<string, number>();
  const covered = new Set<PlayerId>();
  for (const event of log.events) {
    if (event.type === 'ships-launched') event.ships.forEach((ship) => owners.set(ship.id, ship.owner));
    if (event.type === 'materials-used') {
      for (const use of event.uses) {
        const key = use.material.kind === 'build' ? `build:${use.material.building}` : `${use.material.kind}:${use.material.ship}`;
        if (!took.has(`${use.playerId}|${key}`)) took.set(`${use.playerId}|${key}`, event.round);
      }
    }
    if (event.type === 'roles-revealed' && event.role === 'smuggler') {
      for (const d of event.deployments) {
        if (d.targetShipId === null || owners.get(d.targetShipId) !== d.playerId) continue;
        const two = event.round > reveal;
        t.covers[two ? 'two' : 'one'] += 1;
        if (two) covered.add(d.playerId);
      }
    }
    if (event.type === 'v08-effect') {
      const entry = (t.triggers[event.effect] ??= { one: 0, two: 0 });
      entry[event.round > reveal ? 'two' : 'one'] += 1;
    }
  }
  addBets(stats.v08.events, ev.tide, ev.tideCandidates, reveal, took, log.finalState.players, win);
  for (const player of log.finalState.players) {
    for (const answer of TIDE_ANSWERS) {
      const round = took.get(`${player.id}|${answer}`);
      if (round === undefined) continue;
      const a = t.answers[answer]!;
      a.seats += 1;
      a.wins += win(player.id);
      a[round < reveal ? 'before' : 'after'] += 1;
    }
    if (covered.has(player.id)) {
      t.coverSeats += 1;
      t.coverWins += win(player.id);
    }
  }
}

const groupTally = () => ({ seats: 0, wins: 0 });

/** The betting groups of one match (see BetStats). Mutates `e` (local accumulator). */
function addBets(
  e: V08EventStats,
  tide: string,
  candidates: readonly string[],
  reveal: number,
  took: ReadonlyMap<string, number>,
  players: readonly { readonly id: PlayerId }[],
  win: (id: PlayerId) => number,
): void {
  for (const player of players) {
    const right = TIDE_ANSWERS.some((answer) => ANSWER_TIDE[answer] === tide && (took.get(`${player.id}|${answer}`) ?? reveal) < reveal);
    const overall = right ? e.betRight : e.betOthers;
    overall.seats += 1;
    overall.wins += win(player.id);
    for (const answer of TIDE_ANSWERS) {
      const kind = ANSWER_TIDE[answer]!;
      if (!candidates.includes(kind)) continue;
      const b = (e.bets[answer] ??= { right: groupTally(), wrong: groupTally(), afterMatch: groupTally(), afterOther: groupTally(), never: groupTally() });
      const round = took.get(`${player.id}|${answer}`);
      const group = round === undefined ? b.never : round < reveal ? (kind === tide ? b.right : b.wrong) : kind === tide ? b.afterMatch : b.afterOther;
      group.seats += 1;
      group.wins += win(player.id);
    }
  }
}

function addCash(stats: SimStats, reason: string, amount: number): void {
  if (reason === 'pirate-loot' || reason === 'smuggling-seized') {
    stats.pirateIncome += amount;
  } else if (reason === 'diplomat-take') {
    stats.diplomatTake += amount > 0 ? amount : 0;
  } else if (reason === 'goods-confiscated') {
    stats.armsConfiscatedCash += amount;
  } else if (reason === 'insurance') {
    stats.insurancePaid += amount;
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
