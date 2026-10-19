import {
  GOODS,
  RULES_V07,
  buildingCost,
  type BuildingId,
  type Deployment,
  type Goods,
  type IslandId,
  type MatchEvent,
  type MatchResult,
  type PlayerId,
  type Rules,
  type RoleId,
  type ShipId,
  type VoyageEventId,
  type VoyageModifier,
  type VoyageOutcome,
} from '../../v07/game';

const NONE: Goods = { wood: 0, iron: 0, spice: 0, arms: 0 };

export interface BoardShip {
  readonly id: ShipId;
  readonly owner: PlayerId;
  readonly outcome: VoyageOutcome | null;
  /** Public only once the ship is resolved (§4). */
  readonly cargo: Goods | null;
  readonly rerolled: boolean;
  /** Announced just before the outcome (§4 結算起始骰值與修正). */
  readonly modifier: VoyageModifier | null;
  readonly confiscatedArms: number;
  readonly smuggling: 'taken' | 'caught' | 'seized' | 'lost' | null;
}

export interface BoardPlayer {
  readonly id: PlayerId;
  readonly cash: number;
  /**
   * Warehouse as the public events show it. A launched ship's cargo stays counted here until the
   * ship is resolved and the cargo becomes public (the loaded goods are secret, §4).
   */
  readonly stock: Goods;
  readonly buildings: readonly BuildingId[];
  readonly island: IslandId | null;
  /** Round each role was last deployed (§9.3). */
  readonly lastUsed: Readonly<Partial<Record<RoleId, number>>>;
}

export interface MarketSettlement {
  readonly arrived: Goods;
  readonly priceBefore: Goods;
  readonly priceAfter: Goods;
}

/**
 * Table state rebuilt from public events only, so it is safe for any viewer (spectators
 * included) and can be replayed up to any playback position. The 3D scene (stage 5c) reads this too.
 */
export interface Board {
  readonly round: number;
  readonly prices: Goods;
  readonly demand: Goods;
  readonly wanted: readonly PlayerId[];
  readonly voyageEvent: VoyageEventId | null;
  readonly players: Readonly<Record<PlayerId, BoardPlayer>>;
  readonly ships: readonly BoardShip[];
  readonly stayedInPort: readonly PlayerId[];
  readonly launched: boolean;
  readonly revealedRoles: readonly Deployment[];
  /** Roles revealed so far; the reveal plays group by group. */
  readonly rolesShown: readonly RoleId[];
  readonly rerolledShipIds: readonly ShipId[];
  readonly settlement: MarketSettlement | null;
  readonly result: MatchResult | null;
}

export function initialBoard(playerIds: readonly PlayerId[], startingCash: number, rules: Rules = RULES_V07): Board {
  return {
    round: 0,
    prices: Object.fromEntries(GOODS.map((g) => [g, rules.price.tracks[g].start])) as unknown as Goods,
    demand: NONE,
    wanted: [],
    voyageEvent: null,
    players: Object.fromEntries(
      playerIds.map((id) => [id, { id, cash: startingCash, stock: rules.startingStock, buildings: [], island: null, lastUsed: {} }]),
    ),
    ships: [],
    stayedInPort: [],
    launched: false,
    revealedRoles: [],
    rolesShown: [],
    rerolledShipIds: [],
    settlement: null,
    result: null,
  };
}

const addTo = (a: Goods, b: Goods, sign: 1 | -1 = 1): Goods => ({
  wood: Math.max(0, a.wood + sign * b.wood),
  iron: Math.max(0, a.iron + sign * b.iron),
  spice: Math.max(0, a.spice + sign * b.spice),
  arms: Math.max(0, a.arms + sign * b.arms),
});

function mapPlayer(board: Board, id: PlayerId, fn: (p: BoardPlayer) => BoardPlayer): Board {
  const player = board.players[id];
  return player ? { ...board, players: { ...board.players, [id]: fn(player) } } : board;
}

function mapShip(board: Board, id: ShipId, fn: (s: BoardShip) => BoardShip): Board {
  return { ...board, ships: board.ships.map((s) => (s.id === id ? fn(s) : s)) };
}

export function applyEvent(board: Board, event: MatchEvent, rules: Rules = RULES_V07): Board {
  switch (event.type) {
    case 'islands-chosen':
      return Object.entries(event.islands).reduce((b, [id, island]) => mapPlayer(b, id, (p) => ({ ...p, island })), board);
    case 'round-started':
      return {
        ...board,
        round: event.round,
        voyageEvent: null,
        ships: [],
        stayedInPort: [],
        launched: false,
        revealedRoles: [],
        rolesShown: [],
        rerolledShipIds: [],
        settlement: null,
      };
    case 'goods-produced':
      return Object.entries(event.produced).reduce((b, [id, goods]) => mapPlayer(b, id, (p) => ({ ...p, stock: addTo(p.stock, goods) })), board);
    case 'demand-revealed':
      return { ...board, demand: event.demand, prices: event.prices };
    case 'wanted-marked':
      return { ...board, wanted: event.players };
    case 'buildings-built':
      return event.builds.reduce(
        (b, build) =>
          mapPlayer(b, build.playerId, (p) => ({
            ...p,
            buildings: [...p.buildings, build.building],
            stock: addTo(p.stock, buildingCost(rules, build.building), -1),
          })),
        board,
      );
    case 'ships-launched':
      return {
        ...board,
        launched: true,
        stayedInPort: event.stayedInPort,
        ships: event.ships.map((s) => ({
          id: s.id,
          owner: s.owner,
          outcome: s.outcome,
          cargo: null,
          rerolled: false,
          modifier: null,
          confiscatedArms: 0,
          smuggling: null,
        })),
      };
    case 'cash-changed':
      return mapPlayer(board, event.playerId, (p) => ({ ...p, cash: p.cash + event.amount }));
    case 'voyage-event-revealed':
      return { ...board, voyageEvent: event.event };
    case 'roles-revealed': {
      const withUse = event.deployments.reduce(
        (b, d) => mapPlayer(b, d.playerId, (p) => ({ ...p, lastUsed: { ...p.lastUsed, [d.role]: event.round } })),
        board,
      );
      return {
        ...withUse,
        revealedRoles: [...board.revealedRoles, ...event.deployments],
        rolesShown: [...board.rolesShown, event.role],
        rerolledShipIds: [...board.rerolledShipIds, ...event.rerolledShipIds],
        ships: withUse.ships.map((s) => (event.rerolledShipIds.includes(s.id) ? { ...s, rerolled: true } : s)),
      };
    }
    case 'voyage-modifiers':
      return { ...board, ships: board.ships.map((s) => ({ ...s, modifier: event.modifiers.find((m) => m.shipId === s.id) ?? s.modifier })) };
    case 'ship-resolved': {
      const resolved = mapShip(board, event.shipId, (s) => ({ ...s, outcome: event.outcome, cargo: event.cargo }));
      const owner = resolved.ships.find((s) => s.id === event.shipId)?.owner;
      return owner ? mapPlayer(resolved, owner, (p) => ({ ...p, stock: addTo(p.stock, event.cargo, -1) })) : resolved;
    }
    case 'arms-confiscated':
      return mapShip(board, event.shipId, (s) => ({ ...s, confiscatedArms: event.units }));
    case 'smuggling-settled':
      return mapShip(board, event.shipId, (s) => ({ ...s, smuggling: event.result }));
    case 'market-settled':
      return {
        ...board,
        prices: event.priceAfter,
        settlement: { arrived: event.arrived, priceBefore: event.priceBefore, priceAfter: event.priceAfter },
      };
    case 'goods-kept':
      return mapPlayer(board, event.playerId, (p) => ({ ...p, stock: addTo(p.stock, event.goods) }));
    case 'goods-salvaged':
      return mapPlayer(board, event.playerId, (p) => ({ ...p, stock: addTo(p.stock, { ...NONE, [event.good]: 1 }) }));
    case 'spice-spoiled':
      return Object.entries(event.spoiled).reduce(
        (b, [id, n]) => mapPlayer(b, id, (p) => ({ ...p, stock: { ...p.stock, spice: Math.max(0, p.stock.spice - n) } })),
        board,
      );
    case 'match-ended':
      return { ...board, result: event.result };
    case 'phase-started':
    case 'round-ended':
      return board;
  }
}

export function buildBoard(playerIds: readonly PlayerId[], startingCash: number, events: readonly MatchEvent[], rules: Rules = RULES_V07): Board {
  return events.reduce((board, event) => applyEvent(board, event, rules), initialBoard(playerIds, startingCash, rules));
}
