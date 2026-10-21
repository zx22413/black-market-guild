import type { DecisionContext } from '../bots';
import type { Action, Bet, BuildingId, DecisionPhase, GoodId, Goods, IslandId, PlayerId, RoleId, Rules, VoyageEventId } from '../game';

// The beginner tutorial (docs/tutorial-outline.md): a scripted match whose hidden draws are fixed
// and whose bots follow a plan, so every lesson plays out as written. A script never sets anything
// public (cash, stock, prices): those still come from real actions through the engine.

export type TutorialId = 'basics' | 'guard' | 'pirate' | 'intel' | 'smuggler' | 'arms-cover' | 'broker' | 'islands';

/** One seat's choices for one round; anything left out means: stay in port, deploy nothing. */
export interface SeatPlan {
  readonly build?: BuildingId;
  readonly load?: Partial<Goods>;
  /** A role and the owner of the ship it targets. */
  readonly role?: readonly [Exclude<RoleId, 'broker'>, PlayerId];
  /** The broker instead: a bet, and the owner of the ship it names (none for a plain bet). */
  readonly bet?: Bet & { readonly aim?: PlayerId };
  /** Intel only: reroll the ship of this owner. */
  readonly reroll?: PlayerId;
}

/** What the person at the tutorial does in one decision phase. */
export interface YouPhase {
  /** The action the script expects; played for you when `choose` is false. */
  readonly demo: SeatPlan;
  /** You make this decision on the table, among the actions `allow` keeps. */
  readonly choose: boolean;
  readonly allow?: (action: Action, context: DecisionContext) => boolean;
  /** The choice is complete: 「提交」 lights up. Choosing what the demo does, when left out. */
  readonly ready?: (action: Action, context: DecisionContext) => boolean;
}

export interface RoundScript {
  /** The demand card turned this round (§7.2). */
  readonly demand: Goods;
  /** The voyage event drawn this round (§12). */
  readonly event: VoyageEventId;
  /** Raw 1d6 per ship owner; owners left out roll 6. */
  readonly rolls?: Readonly<Record<PlayerId, number>>;
  /** The new roll of a ship an intel merchant rerolls, by ship owner. */
  readonly rerolls?: Readonly<Record<PlayerId, number>>;
  /** Bot seats' choices by player id. */
  readonly bots?: Readonly<Record<PlayerId, SeatPlan>>;
  /** Your decisions; phases left out are played for you with an empty plan. */
  readonly you?: Partial<Record<Exclude<DecisionPhase, 'island-choice'>, YouPhase>>;
}

export interface TutorialSeat {
  readonly name: string;
  /** The island this seat plays (dealt in its draft offers). */
  readonly island: IslandId;
  /** The other island in its offers; any island no seat plays when left out. */
  readonly offer?: IslandId;
}

/** Where a host step belongs in the match (§5). */
export type CoachTrigger =
  /** Before your decision of that phase (the island draft is round 0); the decision waits until the step is read. */
  | { readonly kind: 'decision'; readonly round: number; readonly phase: DecisionPhase }
  /** While that round's resolution plays. */
  | { readonly kind: 'resolution'; readonly round: number }
  /**
   * When the result of every listed player's ship has shown in that round's voyage (the show waits
   * there until the step is read). A round that plays out without them shows it at the end.
   */
  | { readonly kind: 'voyage'; readonly round: number; readonly owners: readonly PlayerId[] }
  /** When that round's resolution reaches the market card (it waits there until the step is read). */
  | { readonly kind: 'market'; readonly round: number }
  /** After the last resolution has played. */
  | { readonly kind: 'end' };

/**
 * What a step lights up; the rest of the screen goes dark. Named by meaning, not by screen
 * position: the table decides where each one is drawn.
 */
export type FocusTarget =
  | { readonly kind: 'market' }
  | { readonly kind: 'price'; readonly good: GoodId }
  | { readonly kind: 'island'; readonly player: PlayerId }
  | { readonly kind: 'plate'; readonly player: PlayerId }
  | { readonly kind: 'rank' }
  | { readonly kind: 'log' }
  | { readonly kind: 'round' }
  /** The bottom bar: the decision's summary and submit, or the resolution's progress. */
  | { readonly kind: 'bar' }
  /** The role cards. */
  | { readonly kind: 'hand' }
  | { readonly kind: 'reroll' }
  /** The decision's submit button, lit once your choice is complete. */
  | { readonly kind: 'submit' }
  /** A role card in the hand ('none' is 「不部署」). */
  | { readonly kind: 'role'; readonly role: RoleId | 'none' }
  /** The 「＋」 over a player's ship, to send the picked role there. */
  | { readonly kind: 'target'; readonly player: PlayerId }
  /** A broker's 漲／跌 button on the market strip. */
  | { readonly kind: 'bet'; readonly good: GoodId; readonly direction: 1 | -1 }
  /** A warehouse stack, until `count` of its crates are on the ship. */
  | { readonly kind: 'crate'; readonly good: GoodId; readonly count: number }
  /** A building's card in the building list, or the button that opens the list while it is closed. */
  | { readonly kind: 'build'; readonly building: BuildingId }
  /** The market card of a resolution: how each price moved. */
  | { readonly kind: 'market-card' }
  /** The voyage beat's tag over a ship: its die, steps and result.  */
  | { readonly kind: 'beat' }
  /** The voyage event card, while it is shown at the start of a resolution. */
  | { readonly kind: 'event' }
  /** What moves the resolution on (「繼續」「開始航程」, the receipt's 「點任意處繼續」). */
  | { readonly kind: 'advance' }
  /** The island draft's two cards, and the reveal of everyone's islands. */
  | { readonly kind: 'draft' }
  | { readonly kind: 'reveal' }
  /** The rules book button. */
  | { readonly kind: 'rules' }
  /** A question the table asks before going on (「還沒做完」, submit anyway?). */
  | { readonly kind: 'dialog' };

/** Some targets lit together: done once any of them is (a choice between ships, say). */
export type GuideStep = FocusTarget | readonly FocusTarget[];

/** One thing the host explains; `todo` is what to do next, kept on screen while you do it. */
export interface CoachStep {
  readonly trigger: CoachTrigger;
  /** Lit while the step is read (and, for the last step before a decision, while you decide). */
  readonly focus: readonly FocusTarget[];
  readonly title: string;
  readonly lines: readonly string[];
  readonly todo?: string;
  /**
   * While you carry out `todo`: what to click, in order. Only the first one not done yet is lit
   * (then 「提交」 once the choice is complete); without it the step's `focus` stays lit.
   */
  readonly guide?: readonly GuideStep[];
}

export interface TutorialScript {
  readonly id: TutorialId;
  readonly title: string;
  /** One line for the tutorial menu. */
  readonly summary: string;
  readonly seed: number;
  /** The rules the match runs with: the official numbers, only fewer rounds. */
  readonly rules: Rules;
  /** Seat 1 (`p1`) is always you; the others are bots. */
  readonly seats: readonly TutorialSeat[];
  readonly rounds: readonly RoundScript[];
  readonly coach: readonly CoachStep[];
  /** You pick your island from the draft yourself (otherwise seat 1's island is picked for you). */
  readonly youDraft?: boolean;
  /** Show the reveal of everyone's islands before round 1 (lessons that are not about islands skip it). */
  readonly showIslandReveal?: boolean;
}

export const YOU: PlayerId = 'p1';
