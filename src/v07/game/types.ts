import type { RngState } from './rng';
import type { Rules } from './rules';

// V0.7 rules engine types (docs/game-design.md). Section references (§) point to that file.

export type PlayerId = string;
export type ShipId = string;

/** §6.1. Order matters: it breaks ties for insurance and salvage (§10.2). */
export const GOODS = ['wood', 'iron', 'spice', 'arms'] as const;
export type GoodId = (typeof GOODS)[number];
/** Units per good; also used for price-track steps per good. */
export type Goods = Readonly<Record<GoodId, number>>;

/** §10.2 */
export const BUILDING_IDS = ['shipyard', 'insurance', 'salvage', 'exchange'] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

/** §9.4, in reveal order. */
export const ROLE_IDS = ['customs', 'guard', 'pirate', 'smuggler', 'diplomat'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

/**
 * Experiment (rules.ships, docs/proposals/2026-11-ship-bays.md, not a decided rule): the ship a player
 * sails this round. Each type has its own payout curve over the final value.
 */
export const SHIP_TYPE_IDS = ['standard', 'gambler', 'freighter', 'hidden', 'breaker'] as const;
export type ShipTypeId = (typeof SHIP_TYPE_IDS)[number];

/** §11.2 */
export const ISLAND_IDS = ['spice-isles', 'pirate-cove', 'lumber', 'mine', 'smuggler-port', 'free-port', 'fortress', 'lighthouse'] as const;
export type IslandId = (typeof ISLAND_IDS)[number];

/** §12 */
export const VOYAGE_EVENT_IDS = ['tailwind', 'storm', 'sea-fog', 'moonless-night', 'black-market-rush', 'calm-seas'] as const;
export type VoyageEventId = (typeof VOYAGE_EVENT_IDS)[number];

/** Decision phases in order: the island draft once before round 1 (§11.1), then every round (§5). */
export const DECISION_PHASES = ['island-choice', 'invest', 'role-deployment'] as const;
export type DecisionPhase = (typeof DECISION_PHASES)[number];
export type Phase = DecisionPhase | 'game-over';

export type Action =
  | { readonly type: 'choose-island'; readonly playerId: PlayerId; readonly island: IslandId }
  | {
      readonly type: 'invest';
      readonly playerId: PlayerId;
      readonly build: BuildingId | null;
      /** Cargo for this player's ship; nothing loaded means not sailing (§8). */
      readonly load: Goods;
      /** Experiment (rules.ships.enabled): the ship type; present exactly when something is loaded. */
      readonly shipType?: ShipTypeId;
    }
  | {
      readonly type: 'deploy-role';
      readonly playerId: PlayerId;
      readonly role: RoleId | null;
      /** Every role targets a ship: customs an opponent's, guard and diplomat the player's own (§9.4). */
      readonly targetShipId: ShipId | null;
      /** Customs only: the good named for confiscation (§9.4). */
      readonly namedGood: GoodId | null;
      /** Diplomat only: the role guessed to aim at the player's own ship. */
      readonly guessRole?: RoleId | null;
    };

export type ActionType = Action['type'];

export const PHASE_ACTION_TYPE: Readonly<Record<DecisionPhase, ActionType>> = {
  'island-choice': 'choose-island',
  invest: 'invest',
  'role-deployment': 'deploy-role',
};

export type VoyageOutcome = 'arrived' | 'sank';

export interface Ship {
  readonly id: ShipId;
  readonly owner: PlayerId;
  /** Secret until the ship is resolved (§4). */
  readonly cargo: Goods;
  /** Experiment (rules.ships): the ship type; 'standard' when the experiment is off. */
  readonly type: ShipTypeId;
  /** The round the ship is resolved in: its launch round, plus the type's delay (rules.ships). */
  readonly arriveRound: number;
  /** Hidden raw 1d6. */
  readonly rawRoll: number;
  readonly outcome: VoyageOutcome | null;
}

/** A locked role deployment (§9). */
export interface Deployment {
  readonly playerId: PlayerId;
  readonly role: RoleId;
  readonly targetShipId: ShipId | null;
  readonly namedGood: GoodId | null;
  /** Diplomat only: the role guessed to aim at the player's own ship. */
  readonly guessRole?: RoleId | null;
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly name: string;
  readonly cash: number;
  readonly stock: Goods;
  readonly buildings: readonly BuildingId[];
  /** null only during the island draft. */
  readonly island: IslandId | null;
  /** Round each role was last deployed, for cooldowns (§9.3). */
  readonly lastUsed: Readonly<Partial<Record<RoleId, number>>>;
  /** Experiment (rules.ships): round each ship type was last launched, for cooldowns. */
  readonly lastShip: Readonly<Partial<Record<ShipTypeId, number>>>;
}

export interface Build {
  readonly playerId: PlayerId;
  readonly building: BuildingId;
}

export interface RoundState {
  readonly demand: Goods;
  /** §9.6 */
  readonly wanted: readonly PlayerId[];
  /** Warehouses after production, public before anyone loads (§4). */
  readonly stockAtStart: Readonly<Record<PlayerId, Goods>>;
  readonly voyageEvent: VoyageEventId | null;
  /** Secret submissions for the current decision phase. */
  readonly submissions: Readonly<Record<PlayerId, Action>>;
  readonly builds: readonly Build[];
  readonly ships: readonly Ship[];
  /** Secret until rolesRevealed. */
  readonly deployments: readonly Deployment[];
  readonly rolesRevealed: boolean;
}

export interface Standing {
  readonly playerId: PlayerId;
  readonly cash: number;
  readonly buildingValue: number;
  readonly wealth: number;
  /** 1 = winner; tied players share a rank. */
  readonly rank: number;
}

export interface MatchResult {
  readonly standings: readonly Standing[];
  readonly winners: readonly PlayerId[];
}

export interface MatchState {
  readonly rules: Rules;
  readonly seed: number;
  readonly round: number;
  readonly phase: Phase;
  readonly players: readonly PlayerState[];
  readonly rng: RngState;
  /** Experiment (rules.ships): launched ships still at sea, resolved when their arriveRound opens. */
  readonly transit: readonly Ship[];
  /** Remaining draw piles; index 0 is next. Hidden. */
  readonly demandDeck: readonly Goods[];
  readonly voyageDeck: readonly VoyageEventId[];
  /** Current price-track step per good (§7.1). */
  readonly prices: Goods;
  /** Island draft offers (§11.1); private to each player. */
  readonly islandOffers: Readonly<Record<PlayerId, readonly IslandId[]>>;
  readonly roundState: RoundState;
  readonly result: MatchResult | null;
}

export type CashReason =
  | 'build'
  | 'ship-cost'
  | 'sale'
  | 'role-fee'
  | 'smuggling'
  | 'smuggling-fine'
  | 'smuggling-confiscated'
  | 'smuggling-seized'
  | 'goods-confiscated'
  | 'pirate-loot'
  | 'insurance'
  | 'exchange-commission'
  | 'diplomat-take'
  | 'diplomat-refund';

/** Public resolution summary for one ship (§4 結算起始骰值與修正, §9.1). */
export interface VoyageModifier {
  readonly shipId: ShipId;
  readonly base: number;
  readonly guard: number;
  readonly pirate: number;
  readonly event: number;
  readonly island: number;
  readonly final: number;
}

/** Ship information every player sees: no cargo until resolution (§4). */
export interface PublicShip {
  readonly id: ShipId;
  readonly owner: PlayerId;
  readonly type: ShipTypeId;
  readonly outcome: VoyageOutcome | null;
}

/** Public events in playback order. Never contain hidden information. */
export type MatchEvent =
  | { readonly type: 'islands-chosen'; readonly islands: Readonly<Record<PlayerId, IslandId>> }
  | { readonly type: 'round-started'; readonly round: number }
  | { readonly type: 'goods-produced'; readonly round: number; readonly produced: Readonly<Record<PlayerId, Goods>> }
  | { readonly type: 'demand-revealed'; readonly round: number; readonly demand: Goods; readonly prices: Goods }
  | { readonly type: 'wanted-marked'; readonly round: number; readonly players: readonly PlayerId[] }
  /** Experiment (rules.ships): ships launched in an earlier round reach this round's voyage (their cargo stays secret). */
  | { readonly type: 'ships-arriving'; readonly round: number; readonly ships: readonly PublicShip[] }
  | { readonly type: 'phase-started'; readonly round: number; readonly phase: DecisionPhase }
  | { readonly type: 'buildings-built'; readonly round: number; readonly builds: readonly Build[] }
  | { readonly type: 'ships-launched'; readonly round: number; readonly ships: readonly PublicShip[]; readonly stayedInPort: readonly PlayerId[] }
  | {
      readonly type: 'cash-changed';
      readonly round: number;
      readonly playerId: PlayerId;
      readonly amount: number;
      readonly reason: CashReason;
      readonly shipId: ShipId | null;
    }
  | { readonly type: 'voyage-event-revealed'; readonly round: number; readonly event: VoyageEventId }
  | {
      readonly type: 'roles-revealed';
      readonly round: number;
      /** One event per role in reveal order (§9.4). */
      readonly role: RoleId;
      readonly deployments: readonly Deployment[];
    }
  | { readonly type: 'voyage-modifiers'; readonly round: number; readonly modifiers: readonly VoyageModifier[] }
  | {
      readonly type: 'ship-resolved';
      readonly round: number;
      readonly shipId: ShipId;
      readonly outcome: VoyageOutcome;
      /** Cargo becomes public here (§4). */
      readonly cargo: Goods;
    }
  | {
      readonly type: 'goods-confiscated';
      readonly round: number;
      readonly shipId: ShipId;
      readonly good: GoodId;
      readonly units: number;
      readonly customs: readonly PlayerId[];
    }
  | {
      readonly type: 'smuggling-settled';
      readonly round: number;
      readonly shipId: ShipId;
      readonly smugglers: readonly PlayerId[];
      readonly result: 'taken' | 'caught' | 'seized' | 'lost';
    }
  | {
      readonly type: 'market-settled';
      readonly round: number;
      readonly demand: Goods;
      readonly arrived: Goods;
      readonly priceBefore: Goods;
      readonly priceAfter: Goods;
    }
  | { readonly type: 'goods-salvaged'; readonly round: number; readonly playerId: PlayerId; readonly good: GoodId; readonly shipId: ShipId }
  | { readonly type: 'spice-spoiled'; readonly round: number; readonly spoiled: Readonly<Record<PlayerId, number>> }
  | { readonly type: 'round-ended'; readonly round: number }
  | { readonly type: 'match-ended'; readonly result: MatchResult };

/** Information for one player only; route it to that player, never broadcast it. */
export type PrivateEvent =
  | { readonly playerId: PlayerId; readonly type: 'island-offers'; readonly islands: readonly IslandId[] }
  | { readonly playerId: PlayerId; readonly type: 'cargo-loaded'; readonly round: number; readonly shipId: ShipId; readonly cargo: Goods };

export interface PendingDecision {
  readonly playerId: PlayerId;
  readonly phase: DecisionPhase;
}

export type RuleErrorCode =
  | 'invalid-config'
  | 'match-over'
  | 'unknown-player'
  | 'wrong-phase'
  | 'not-a-decider'
  | 'already-submitted'
  | 'illegal-action';

export interface RuleError {
  readonly code: RuleErrorCode;
  readonly message: string;
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RuleError };

export interface Transition {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
  readonly privateEvents: readonly PrivateEvent[];
}

/** Internal engine step. */
export interface Step {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
  readonly privateEvents?: readonly PrivateEvent[];
}
