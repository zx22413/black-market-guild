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

/** V0.8 prototype (v08-rules.ts, not a rule): the buildings bought with materials, at most one per match. */
export const V08_BUILDING_IDS = ['repairyard', 'armory', 'tradehouse'] as const;
export type V08BuildingId = (typeof V08_BUILDING_IDS)[number];

/** V0.8 prototype: the one material action a player may take in an invest submission. */
export type MaterialAction =
  | { readonly kind: 'open'; readonly ship: ShipTypeId }
  | { readonly kind: 'upgrade'; readonly ship: ShipTypeId }
  | { readonly kind: 'build'; readonly building: V08BuildingId };

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
      /** V0.8 prototype (rules.v08): one material action, paid from the warehouse before loading. */
      readonly material?: MaterialAction;
      /** V0.8 prototype: a gambler with its skill open declares 「加注」 (public with the ship type). */
      readonly raise?: true;
      /** V0.8 prototype: the hidden ship's private crates (its skill's extra hold). */
      readonly privateLoad?: Goods;
      /** V0.8 prototype: a tradehouse owner's protected good, secret until the market settles. */
      readonly protect?: GoodId;
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
  /** V0.8 prototype: a raised gambler. */
  readonly raised?: true;
  /** V0.8 prototype: the hidden ship's private crates (secret like the cargo). */
  readonly privateCargo?: Goods;
  /** V0.8 prototype (rules.v08.crates): crates lost on the voyage, set when the ship is resolved. */
  readonly lost?: Goods;
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
  /** V0.8 prototype: opened ship skills and their level (1 or 2). */
  readonly skills?: Readonly<Partial<Record<ShipTypeId, number>>>;
  /** V0.8 prototype (v08.levelUp): launches of each opened ship type since it was opened. */
  readonly practice?: Readonly<Partial<Record<ShipTypeId, number>>>;
  /** V0.8 prototype: the player's one building. */
  readonly facility?: V08BuildingId;
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
  /**
   * Roles deployed in an earlier round on a freighter that arrives in this one (public since they were revealed then):
   * they take effect with this round's voyage, next to this round's own deployments (game-design.md §8.1).
   */
  readonly carried: readonly Deployment[];
  readonly rolesRevealed: boolean;
  /** V0.8 prototype: each tradehouse owner's protected good this round (secret until the market settles). */
  readonly protect?: Readonly<Record<PlayerId, GoodId>>;
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

/** V0.8 prototype (v08.events): an event-deck card; 'advance' moves the match on (暗潮將至, then the final round). */
export type V08Card = VoyageEventId | 'advance';

/** V0.8 prototype: the final round's effect (黑市大開 / 最後一搏); null when the match ends by the round cap or an empty deck. */
export const FINAL_EFFECTS = ['open-market', 'last-gamble'] as const;
export type FinalEffect = (typeof FINAL_EFFECTS)[number];

/** V0.8 prototype (v08.events): the event deck and the public phase state. */
export interface V08EventsState {
  /** Hidden: the cards still to draw, index 0 next. */
  readonly deck: readonly V08Card[];
  readonly advancesDrawn: number;
  /** The round phase II starts in (the round after 暗潮將至), null before. */
  readonly phaseTwoFrom: number | null;
  /** The round known to be the last one, null before. */
  readonly finalRound: number | null;
  readonly finalEffect: FinalEffect | null;
}

/** V0.8 prototype: the public event-deck status, in PlayerView and used by the engine and the bots alike. */
export interface PublicEvents {
  readonly phase: 1 | 2;
  readonly advancesDrawn: number;
  /** This round is 「暗潮將至」 (half of each warehouse good is lost at its end). */
  readonly darkTide: boolean;
  /** This round is the last one. */
  readonly finalRound: boolean;
  /** This round's final effect (only in the final round). */
  readonly finalEffect: FinalEffect | null;
  readonly deckRemaining: number;
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
  /** V0.8 prototype (v08.events): the event deck and phases; absent when the switch is off. */
  readonly v08Events?: V08EventsState;
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
  | 'diplomat-refund'
  /** V0.8 prototype: crates a freighter salvaged, paid by the bank. */
  | 'salvage-sale'
  /** V0.8 prototype (fortress + armory): a pirate's deployment fee paid to the targeted owner. */
  | 'pirate-toll';

/** V0.8 prototype: what a skill, building or island variant did, for the simulation report. `value` is G gained (or denied). */
export const V08_EFFECTS = [
  'reroll',
  'reroll-saved',
  'extra-die',
  'raise-won',
  'raise-lost',
  'salvage',
  'private-sold',
  'repairyard',
  'armory',
  'tradehouse',
  'pirate-toll',
  'customs-halved',
  'inspected',
  'level-up',
] as const;
export type V08Effect = (typeof V08_EFFECTS)[number];

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
  /** V0.8 prototype: a raised gambler (public at launch). */
  readonly raised?: true;
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
      /** V0.8 prototype: crates lost on the voyage, and the hidden ship's private crates. */
      readonly lost?: Goods;
      readonly privateCargo?: Goods;
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
  /** V0.8 prototype: the material actions everyone took this round. */
  | { readonly type: 'materials-used'; readonly round: number; readonly uses: readonly { readonly playerId: PlayerId; readonly material: MaterialAction }[] }
  /** V0.8 prototype: tradehouse owners' protected goods, revealed when the market settles. */
  | { readonly type: 'trade-protected'; readonly round: number; readonly protect: Readonly<Record<PlayerId, GoodId>> }
  /** V0.8 prototype: a skill, building or island variant took effect (report only; the cash moves are their own events). */
  | {
      readonly type: 'v08-effect';
      readonly round: number;
      readonly playerId: PlayerId;
      readonly shipId: ShipId | null;
      readonly effect: V08Effect;
      readonly crates: number;
      readonly value: number;
    }
  /** V0.8 prototype (v08.events): the 1st advance card. Phase II starts next round. */
  | { readonly type: 'dark-tide-rising'; readonly round: number }
  /** V0.8 prototype: this round is the last one (the 2nd advance card, or the round cap / an empty deck with no effect). */
  | { readonly type: 'final-round'; readonly round: number; readonly effect: FinalEffect | null; readonly demand: Goods }
  /** V0.8 prototype: the first phase II round opens. */
  | { readonly type: 'phase-two-started'; readonly round: number }
  /** V0.8 prototype: this round's regular event is its phase II (boss) version. */
  | { readonly type: 'boss-event'; readonly round: number; readonly event: VoyageEventId }
  /** V0.8 prototype: goods lost from the warehouses at the end of a 「暗潮將至」 round. */
  | { readonly type: 'dark-tide-loss'; readonly round: number; readonly lost: Readonly<Record<PlayerId, Goods>> }
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
