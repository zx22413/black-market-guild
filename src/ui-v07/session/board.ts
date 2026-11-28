import {
  GOODS,
  RULES_CURRENT,
  buildingCost,
  materialCost,
  type BuildingId,
  type GoodId,
  type Deployment,
  type Goods,
  type IslandId,
  type MatchEvent,
  type MatchResult,
  type PlayerId,
  type Rules,
  type RoleId,
  type ShipId,
  type ShipTypeId,
  type V08BuildingId,
  type VoyageEventId,
  type VoyageModifier,
  type VoyageOutcome,
} from '../../v07/game';

const NONE: Goods = { wood: 0, iron: 0, spice: 0, arms: 0 };

export interface BoardShip {
  readonly id: ShipId;
  readonly owner: PlayerId;
  readonly type: ShipTypeId;
  /** Launched in an earlier round and arriving in this one (a freighter, game-design.md §8.1). */
  readonly fromEarlier: boolean;
  readonly outcome: VoyageOutcome | null;
  /** Public only once the ship is resolved (§4). */
  readonly cargo: Goods | null;
  /** Announced just before the outcome (§4 結算起始骰值與修正). */
  readonly modifier: VoyageModifier | null;
  /** Goods customs took off this ship (§9.4). */
  readonly confiscated: readonly { readonly good: GoodId; readonly units: number }[];
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
  /** V0.8 prototype (not rules): the one building raised with materials, and the ship types whose skill is open. */
  readonly facility: V08BuildingId | null;
  readonly skills: readonly ShipTypeId[];
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
  readonly settlement: MarketSettlement | null;
  readonly result: MatchResult | null;
}

export function initialBoard(playerIds: readonly PlayerId[], startingCash: number, rules: Rules = RULES_CURRENT): Board {
  return {
    round: 0,
    prices: Object.fromEntries(GOODS.map((g) => [g, rules.price.tracks[g].start])) as unknown as Goods,
    demand: NONE,
    wanted: [],
    voyageEvent: null,
    players: Object.fromEntries(
      playerIds.map((id) => [id, { id, cash: startingCash, stock: rules.startingStock, buildings: [], facility: null, skills: [], island: null, lastUsed: {} }]),
    ),
    ships: [],
    stayedInPort: [],
    launched: false,
    revealedRoles: [],
    rolesShown: [],
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

export function applyEvent(board: Board, event: MatchEvent, rules: Rules = RULES_CURRENT): Board {
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
        settlement: null,
      };
    case 'goods-produced':
      return Object.entries(event.produced).reduce((b, [id, goods]) => mapPlayer(b, id, (p) => ({ ...p, stock: addTo(p.stock, goods) })), board);
    case 'demand-revealed':
      return { ...board, demand: event.demand, prices: event.prices };
    // V0.8: the round's card can change this round's demand (貨滿為患 −1, 黑市大開 / 最後的大市集 +1).
    case 'boss-event':
    case 'final-round':
    case 'late-card':
      return { ...board, demand: event.demand };
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
    case 'ships-arriving':
      // Ships launched in an earlier round (a freighter) join this round's voyage.
      return {
        ...board,
        ships: [...board.ships, ...event.ships.map((s) => ({ id: s.id, owner: s.owner, type: s.type, fromEarlier: true, outcome: s.outcome, cargo: null, modifier: null, confiscated: [], smuggling: null }))],
      };
    case 'ships-launched':
      return {
        ...board,
        launched: true,
        stayedInPort: event.stayedInPort,
        // Ships that arrived from an earlier round ('ships-arriving', just after the round started) stay in the voyage.
        ships: [
          ...board.ships,
          ...event.ships.map((s) => ({
            id: s.id,
            owner: s.owner,
            type: s.type,
            fromEarlier: false,
            outcome: s.outcome,
            cargo: null,
            modifier: null,
            confiscated: [],
            smuggling: null,
          })),
        ],
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
      };
    }
    case 'voyage-modifiers':
      return { ...board, ships: board.ships.map((s) => ({ ...s, modifier: event.modifiers.find((m) => m.shipId === s.id) ?? s.modifier })) };
    case 'ship-resolved': {
      const resolved = mapShip(board, event.shipId, (s) => ({ ...s, outcome: event.outcome, cargo: event.cargo }));
      const owner = resolved.ships.find((s) => s.id === event.shipId)?.owner;
      return owner ? mapPlayer(resolved, owner, (p) => ({ ...p, stock: addTo(p.stock, event.cargo, -1) })) : resolved;
    }
    case 'goods-confiscated':
      return mapShip(board, event.shipId, (s) => ({ ...s, confiscated: [...s.confiscated, { good: event.good, units: event.units }] }));
    case 'smuggling-settled':
      return mapShip(board, event.shipId, (s) => ({ ...s, smuggling: event.result }));
    case 'market-settled':
      return {
        ...board,
        prices: event.priceAfter,
        settlement: { arrived: event.arrived, priceBefore: event.priceBefore, priceAfter: event.priceAfter },
      };
    case 'goods-salvaged':
      return mapPlayer(board, event.playerId, (p) => ({ ...p, stock: addTo(p.stock, { ...NONE, [event.good]: 1 }) }));
    case 'spice-spoiled':
      return Object.entries(event.spoiled).reduce(
        (b, [id, n]) => mapPlayer(b, id, (p) => ({ ...p, stock: { ...p.stock, spice: Math.max(0, p.stock.spice - n) } })),
        board,
      );
    case 'match-ended':
      return { ...board, result: event.result };
    // V0.8 prototype: a material action is paid from the warehouse; it raises the one building or opens a ship skill.
    case 'materials-used':
      return {
        ...board,
        players: Object.fromEntries(
          Object.entries(board.players).map(([id, p]) => {
            const mine = event.uses.filter((u) => u.playerId === id).map((u) => u.material);
            const built = mine.find((m) => m.kind === 'build');
            const opened = mine.flatMap((m) => (m.kind === 'open' && !p.skills.includes(m.ship) ? [m.ship] : []));
            // The materials are paid from the warehouse.
            const stock = mine.reduce((left, m) => {
              const cost = materialCost(rules, m);
              return Object.fromEntries(GOODS.map((g) => [g, left[g] - cost[g]])) as Goods;
            }, p.stock);
            return [id, { ...p, stock, facility: built?.kind === 'build' ? built.building : p.facility, skills: [...p.skills, ...opened] }];
          }),
        ),
      };
    // V0.8 prototype: 「暗潮將至」 takes goods out of every warehouse at the end of its round.
    case 'dark-tide-loss':
      return {
        ...board,
        players: Object.fromEntries(
          Object.entries(board.players).map(([id, p]) => {
            const lost = event.lost[id];
            return [id, lost ? { ...p, stock: Object.fromEntries(GOODS.map((g) => [g, p.stock[g] - lost[g]])) as Goods } : p];
          }),
        ),
      };
    // V0.8 prototype: the tradehouse takes one leftover crate at the end of the round.
    case 'leftover-bought':
      return mapPlayer(board, event.playerId, (p) => ({ ...p, stock: { ...p.stock, [event.good]: Math.max(0, p.stock[event.good] - 1) } }));
    case 'phase-started':
    case 'round-ended':
    // V0.8 simulation prototype only (never in the live rules).
    case 'trade-protected':
    case 'v08-effect':
    case 'dark-tide-rising':
    case 'phase-two-started':
    case 'tide-candidates':
    case 'tide-revealed':
      return board;
  }
}

export function buildBoard(playerIds: readonly PlayerId[], startingCash: number, events: readonly MatchEvent[], rules: Rules = RULES_CURRENT): Board {
  return events.reduce((board, event) => applyEvent(board, event, rules), initialBoard(playerIds, startingCash, rules));
}
