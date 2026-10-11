import type { RngState, RoleId } from '../../game';
import type { EconomyRules } from './rules';

// Prototype of docs/proposals/2026-10-economy-rework.md §12-13. Not a rule source.

export type PlayerId = string;
export type ShipId = string;

/**
 * Wood and iron build and sell; spice (perishable) and contraband (seizable by guards) only sell
 * (proposal §18). Goods unused by a rule set simply have no production and no demand.
 */
export const MATERIALS = ['wood', 'iron', 'spice', 'contraband'] as const;
export type Material = (typeof MATERIALS)[number];
/** Units per material; also used for price-track steps per material. */
export type Goods = Readonly<Record<Material, number>>;

/** `broker` (牙行, proposal §18) shifts one demand by ±1 each round. */
export const BUILDING_IDS = ['shipyard', 'insurance', 'salvage', 'exchange', 'broker'] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

/** V0.6 voyage events minus high waves (proposal §13.3). */
export const PROTO_VOYAGE_EVENT_IDS = [
  'tailwind',
  'storm',
  'sea-fog',
  'moonless-night',
  'black-market-rush',
  'calm-seas',
] as const;
export type ProtoVoyageEventId = (typeof PROTO_VOYAGE_EVENT_IDS)[number];

export const ECONOMY_PHASES = ['invest', 'role-deployment', 'intel-reroll'] as const;
export type EconomyPhase = (typeof ECONOMY_PHASES)[number];

export type EconomyAction =
  | {
      readonly type: 'invest';
      readonly playerId: PlayerId;
      readonly build: BuildingId | null;
      /** Option A: cargo on the player's own ship. Option B: wood on the wood ship, iron on the iron ship. */
      readonly load: Goods;
      /** Exchange direct sale from the warehouse (exchange variant 2); otherwise zero. */
      readonly direct: Goods;
      /** Broker holders only: shift this round's demand for one material. */
      readonly manipulate: Manipulation | null;
    }
  | {
      readonly type: 'deploy-role';
      readonly playerId: PlayerId;
      readonly role: RoleId | null;
      readonly targetShipId: ShipId | null;
    }
  | { readonly type: 'intel-reroll'; readonly playerId: PlayerId; readonly reroll: boolean };

export const PHASE_ACTION_TYPE: Readonly<Record<EconomyPhase, EconomyAction['type']>> = {
  invest: 'invest',
  'role-deployment': 'deploy-role',
  'intel-reroll': 'intel-reroll',
};

export interface Manipulation {
  readonly material: Material;
  readonly delta: 1 | -1;
}

export interface PlayerManipulation extends Manipulation {
  readonly playerId: PlayerId;
}

export interface CargoLot {
  readonly playerId: PlayerId;
  readonly goods: Goods;
}

export type VoyageOutcome = 'arrived' | 'sank';

export interface EconShip {
  readonly id: ShipId;
  /** Option A: the owner. Option B: null (neutral ship). */
  readonly owner: PlayerId | null;
  /** Option B: the only material the ship carries. Option A: null. */
  readonly material: Material | null;
  readonly cargo: readonly CargoLot[];
  readonly rawRoll: number | null;
  readonly rerolledRoll: number | null;
  readonly outcome: VoyageOutcome | null;
}

export interface Deployment {
  readonly playerId: PlayerId;
  readonly role: RoleId;
  readonly targetShipId: ShipId;
}

export interface Build {
  readonly playerId: PlayerId;
  readonly building: BuildingId;
}

export interface EconPlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly cash: number;
  readonly blackMoney: number;
  readonly buildings: readonly BuildingId[];
  readonly stock: Goods;
}

export interface EconRound {
  readonly demand: Goods;
  /** Players with the most cash at round start; nobody when everyone is tied. */
  readonly wanted: readonly PlayerId[];
  /** Warehouse contents after production, public before anyone loads. */
  readonly stockAtStart: Readonly<Record<PlayerId, Goods>>;
  readonly voyageEvent: ProtoVoyageEventId | null;
  readonly submissions: Readonly<Record<PlayerId, EconomyAction>>;
  readonly builds: readonly Build[];
  /** Secret until settlement, like Option A cargo. */
  readonly directSales: readonly CargoLot[];
  /** Public once investments are revealed. */
  readonly manipulations: readonly PlayerManipulation[];
  readonly ships: readonly EconShip[];
  readonly deployments: readonly Deployment[];
}

/** Settled round kept for simulation statistics; contains secret information. */
export interface RoundRecord {
  readonly round: number;
  readonly demand: Goods;
  readonly wanted: readonly PlayerId[];
  readonly builds: readonly Build[];
  readonly directSales: readonly CargoLot[];
  readonly manipulations: readonly PlayerManipulation[];
  readonly ships: readonly EconShip[];
  readonly deployments: readonly Deployment[];
  readonly voyageEvent: ProtoVoyageEventId | null;
  readonly arrived: Goods;
  readonly priceBefore: Goods;
  readonly priceAfter: Goods;
}

export interface EconomyStanding {
  readonly playerId: PlayerId;
  readonly cash: number;
  readonly buildingValue: number;
  readonly wealth: number;
  readonly rank: number;
}

export interface EconomyResult {
  readonly standings: readonly EconomyStanding[];
  readonly winners: readonly PlayerId[];
}

export interface EconomyState {
  readonly rules: EconomyRules;
  readonly seed: number;
  readonly round: number;
  readonly phase: EconomyPhase | 'game-over';
  readonly players: readonly EconPlayer[];
  readonly rng: RngState;
  readonly demandDeck: readonly Goods[];
  readonly voyageDeck: readonly ProtoVoyageEventId[];
  /** Current price-track step per material (0 = cheapest). */
  readonly prices: Goods;
  readonly roundState: EconRound;
  readonly history: readonly RoundRecord[];
  readonly result: EconomyResult | null;
}

export type CashReason =
  | 'build'
  | 'ship-cost'
  | 'freight'
  | 'sale'
  | 'role-fee'
  | 'smuggling-confiscated'
  | 'smuggling-fine'
  | 'smuggling-seized'
  | 'pirate-loot'
  | 'escort-fee'
  | 'insurance'
  | 'exchange-commission'
  | 'contraband-seized'
  | 'direct-sale'
  | 'black-money';

/** Ship information every player may see; Option A hides other owners' cargo until resolution. */
export interface PublicShip {
  readonly id: ShipId;
  readonly owner: PlayerId | null;
  readonly material: Material | null;
  readonly cargo: readonly CargoLot[] | null;
}

export type EconomyEvent =
  | {
      readonly type: 'round-started';
      readonly round: number;
      readonly demand: Goods;
      readonly wanted: readonly PlayerId[];
      readonly prices: Goods;
    }
  | { readonly type: 'phase-started'; readonly round: number; readonly phase: EconomyPhase }
  | { readonly type: 'buildings-built'; readonly round: number; readonly builds: readonly Build[] }
  | { readonly type: 'ships-launched'; readonly round: number; readonly ships: readonly PublicShip[] }
  | { readonly type: 'market-manipulated'; readonly round: number; readonly manipulations: readonly PlayerManipulation[] }
  | {
      readonly type: 'contraband-seized';
      readonly round: number;
      readonly shipId: ShipId;
      readonly ownerId: PlayerId;
      readonly units: number;
      readonly guards: readonly PlayerId[];
    }
  | {
      readonly type: 'cash-changed';
      readonly round: number;
      readonly playerId: PlayerId;
      readonly amount: number;
      readonly reason: CashReason;
      readonly shipId: ShipId | null;
    }
  | {
      readonly type: 'salvaged';
      readonly round: number;
      readonly playerId: PlayerId;
      readonly material: Material;
      readonly shipId: ShipId;
    }
  | {
      readonly type: 'insured-goods-kept';
      readonly round: number;
      readonly playerId: PlayerId;
      readonly goods: Goods;
      readonly shipId: ShipId;
    }
  | { readonly type: 'voyage-event-revealed'; readonly round: number; readonly event: ProtoVoyageEventId }
  | {
      readonly type: 'roles-revealed';
      readonly round: number;
      /** Smugglers stay anonymous unless caught. */
      readonly deployments: readonly Deployment[];
      readonly rerolledShipIds: readonly ShipId[];
    }
  | {
      readonly type: 'ship-resolved';
      readonly round: number;
      readonly shipId: ShipId;
      readonly base: number;
      readonly guard: number;
      readonly pirate: number;
      readonly event: number;
      readonly final: number;
      readonly outcome: VoyageOutcome;
      readonly cargo: readonly CargoLot[];
    }
  | { readonly type: 'ship-smuggled'; readonly round: number; readonly shipId: ShipId; readonly amount: number }
  | {
      readonly type: 'smugglers-caught';
      readonly round: number;
      readonly shipId: ShipId;
      readonly smugglers: readonly PlayerId[];
    }
  | {
      readonly type: 'market-settled';
      readonly round: number;
      readonly demand: Goods;
      readonly arrived: Goods;
      readonly priceBefore: Goods;
      readonly priceAfter: Goods;
    }
  | { readonly type: 'round-ended'; readonly round: number }
  | { readonly type: 'match-ended'; readonly result: EconomyResult };

export interface EconomyStep {
  readonly state: EconomyState;
  readonly events: readonly EconomyEvent[];
}
