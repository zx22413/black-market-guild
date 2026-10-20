import type { DecisionContext } from '../bots';
import { GOODS, type Action, type Bet, type BuildingId, type Goods, type PlayerId, type RoleId } from '../game';
import { shipOf } from './play';

// Which of your legal actions a tutorial step keeps. Load limits keep every smaller load too, so
// the table can add crates one at a time.

const units = (g: Goods): number => GOODS.reduce((n, k) => n + g[k], 0);

/** Sail with at most `max` of each good (at least one crate), building `build`. */
export const loadWithin =
  (max: Partial<Goods>, build: BuildingId | null = null) =>
  (action: Action): boolean =>
    action.type === 'invest' && action.build === build && units(action.load) > 0 && GOODS.every((g) => action.load[g] <= (max[g] ?? 0));

/**
 * Build `build`, with any load the rules allow. Staying in port is kept too: the table picks the
 * building while the ship is still empty, then adds crates one at a time.
 */
export const buildThen =
  (build: BuildingId) =>
  (action: Action): boolean =>
    action.type === 'invest' && action.build === build;

/** Deploy `role` on the ship of one of `owners`; `orNone` also keeps deploying nothing. */
export const roleOn =
  (role: Exclude<RoleId, 'broker'>, owners: readonly PlayerId[], orNone = false) =>
  (action: Action, context: DecisionContext): boolean =>
    action.type === 'deploy-role' &&
    ((orNone && action.role === null) || (action.role === role && action.peekShipId === null && owners.some((o) => shipOf(context, o) === action.targetShipId)));

/** Either reroll or keep the roll. */
export const rerollOrKeep = (action: Action): boolean => action.type === 'intel-reroll';

/** The broker's bet on `bet`, naming the ship of `aim`. */
export const betOn =
  (bet: Bet, aim: PlayerId) =>
  (action: Action, context: DecisionContext): boolean =>
    action.type === 'deploy-role' &&
    action.role === 'broker' &&
    action.bet?.good === bet.good &&
    action.bet.direction === bet.direction &&
    action.targetShipId === shipOf(context, aim);

/** Invest without building, with a load `test` accepts (the empty load means staying in port). */
export const loadWhere =
  (test: (load: Goods) => boolean) =>
  (action: Action): boolean =>
    action.type === 'invest' && action.build === null && test(action.load);

export const unitsOf = units;
