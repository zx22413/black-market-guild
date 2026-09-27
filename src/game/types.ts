import type { Rules } from './rules';
import type { RngState } from './rng';

export type PlayerId = string;
export type ShipId = string;

// game-design.md §9
export const MARKET_EVENT_IDS = [
  'royal-joint-order', // 皇家聯合訂單
  'private-trade-charter', // 私人貿易特許
  'black-market-bounty', // 黑市懸賞令
  'sea-danger-warning', // 海域危險警報
  'luxury-boom', // 奢侈品熱潮
  'salvage-boom', // 打撈業繁榮
] as const;
export type MarketEventId = (typeof MARKET_EVENT_IDS)[number];

// game-design.md §10
export const VOYAGE_EVENT_IDS = [
  'tailwind', // 順風
  'storm', // 暴風雨
  'sea-fog', // 海霧
  'moonless-night', // 月黑風高
  'high-waves', // 巨浪
  'black-market-rush', // 黑市熱絡
  'calm-seas', // 風平浪靜
] as const;
export type VoyageEventId = (typeof VOYAGE_EVENT_IDS)[number];

// game-design.md §7
export const ROLE_IDS = ['intel', 'guard', 'pirate', 'smuggler'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

// game-design.md §8
export const ASSET_IDS = ['shipyard', 'insurance', 'salvage', 'exchange'] as const;
export type AssetId = (typeof ASSET_IDS)[number];

/** Decision phases in round order (game-design.md §5, §6). */
export const DECISION_PHASES = [
  'asset-purchase',
  'recruit',
  'apply',
  'pick',
  'sailing-choice',
  'role-deployment',
  'intel-reroll',
] as const;
export type DecisionPhase = (typeof DECISION_PHASES)[number];
export type Phase = DecisionPhase | 'game-over';

export type Action =
  | { readonly type: 'buy-asset'; readonly playerId: PlayerId; readonly asset: AssetId | null }
  | { readonly type: 'recruit'; readonly playerId: PlayerId; readonly recruit: boolean }
  | { readonly type: 'apply'; readonly playerId: PlayerId; readonly recruiterId: PlayerId | null }
  | { readonly type: 'pick'; readonly playerId: PlayerId; readonly applicantId: PlayerId | null }
  | { readonly type: 'choose-sailing'; readonly playerId: PlayerId; readonly choice: 'solo' | 'stay' }
  | {
      readonly type: 'deploy-role';
      readonly playerId: PlayerId;
      readonly role: RoleId | null;
      readonly targetShipId: ShipId | null;
    }
  | { readonly type: 'intel-reroll'; readonly playerId: PlayerId; readonly reroll: boolean };

export type ActionType = Action['type'];

export const PHASE_ACTION_TYPE: Readonly<Record<DecisionPhase, ActionType>> = {
  'asset-purchase': 'buy-asset',
  recruit: 'recruit',
  apply: 'apply',
  pick: 'pick',
  'sailing-choice': 'choose-sailing',
  'role-deployment': 'deploy-role',
  'intel-reroll': 'intel-reroll',
};

export type ShipKind = 'solo' | 'joint';
export type VoyageOutcome = 'arrived' | 'sank';

export interface Ship {
  readonly id: ShipId;
  readonly kind: ShipKind;
  /** Solo: [owner]. Joint: [recruiter, applicant]. */
  readonly owners: readonly PlayerId[];
  /** Hidden raw 1d6, rolled once ships are launched (game-design.md §5 step 3). */
  readonly rawRoll: number | null;
  readonly outcome: VoyageOutcome | null;
}

/** Ship information every player may see (game-design.md §4). */
export interface PublicShip {
  readonly id: ShipId;
  readonly kind: ShipKind;
  readonly owners: readonly PlayerId[];
  readonly outcome: VoyageOutcome | null;
}

export type CashReason = 'ship-cost' | 'shipping-income';

/** A player applying to another player's recruitment (game-design.md §6 step 2). */
export interface Application {
  readonly applicantId: PlayerId;
  readonly recruiterId: PlayerId;
}

/** A recruiter picking one applicant (game-design.md §6 step 3). */
export interface Venture {
  readonly recruiterId: PlayerId;
  readonly applicantId: PlayerId;
}

/** Public recruitment information for the current round (game-design.md §4). */
export interface RecruitmentInfo {
  readonly recruiters: readonly PlayerId[];
  readonly applications: readonly Application[];
  readonly ventures: readonly Venture[];
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly name: string;
  readonly cash: number;
  readonly assets: readonly AssetId[];
}

export interface RoundState {
  readonly marketEvent: MarketEventId;
  /** null until revealed after role deployment (game-design.md §5 step 4). */
  readonly voyageEvent: VoyageEventId | null;
  /** Secret submissions for the current decision phase, keyed by player. */
  readonly submissions: Readonly<Record<PlayerId, Action>>;
  /** Ships sailing this round, in launch order. */
  readonly ships: readonly Ship[];
  /** Resolved recruitment results; each list fills in once its phase closes. */
  readonly recruitment: RecruitmentInfo;
}

export interface Standing {
  readonly playerId: PlayerId;
  readonly cash: number;
  readonly assetValue: number;
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
  /** Remaining draw piles; index 0 is the next card. Hidden from players. */
  readonly marketDeck: readonly MarketEventId[];
  readonly voyageDeck: readonly VoyageEventId[];
  readonly roundState: RoundState;
  readonly result: MatchResult | null;
}

/** Public events emitted by the engine. Never contains hidden information. */
export type MatchEvent =
  | { readonly type: 'round-started'; readonly round: number }
  | { readonly type: 'market-event-revealed'; readonly round: number; readonly event: MarketEventId }
  | { readonly type: 'phase-started'; readonly round: number; readonly phase: DecisionPhase }
  | { readonly type: 'recruitments-announced'; readonly round: number; readonly recruiters: readonly PlayerId[] }
  | {
      readonly type: 'applications-announced';
      readonly round: number;
      readonly applications: readonly Application[];
    }
  | { readonly type: 'joint-ventures-formed'; readonly round: number; readonly ventures: readonly Venture[] }
  | {
      readonly type: 'ships-launched';
      readonly round: number;
      readonly ships: readonly Omit<PublicShip, 'outcome'>[];
      readonly stayedInPort: readonly PlayerId[];
    }
  | {
      readonly type: 'cash-changed';
      readonly round: number;
      readonly playerId: PlayerId;
      readonly amount: number;
      readonly reason: CashReason;
      readonly shipId: ShipId | null;
    }
  | { readonly type: 'voyage-event-revealed'; readonly round: number; readonly event: VoyageEventId }
  | { readonly type: 'ship-resolved'; readonly round: number; readonly shipId: ShipId; readonly outcome: VoyageOutcome }
  | { readonly type: 'round-ended'; readonly round: number }
  | { readonly type: 'match-ended'; readonly result: MatchResult };

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

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RuleError };

export interface Transition {
  readonly state: MatchState;
  readonly events: readonly MatchEvent[];
}
