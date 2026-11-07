import type { DecisionContext } from '../bots';
import { GOODS, type Action, type GoodId, type ShipTypeId, type Goods, type PlayerId, type RoleId } from '../game';
import { shipOf } from './play';

// Which of your legal actions a tutorial step keeps. Load limits keep every smaller load too, so
// the table can add crates one at a time.

const units = (g: Goods): number => GOODS.reduce((n, k) => n + g[k], 0);

/** Sail `ship` with at most `max` of each good (at least one crate). */
export const loadWithin =
  (max: Partial<Goods>, ship: ShipTypeId = 'standard') =>
  (action: Action): boolean =>
    action.type === 'invest' && (action.shipType ?? 'standard') === ship && units(action.load) > 0 && GOODS.every((g) => action.load[g] <= (max[g] ?? 0));

/** Sail `ship` with any load the rules allow (the table picks the ship first, then adds crates one at a time). */
export const sailing =
  (ship: ShipTypeId) =>
  (action: Action): boolean =>
    action.type === 'invest' && (action.shipType ?? 'standard') === ship && units(action.load) > 0;

/** Deploy `role` on the ship of one of `owners`; `orNone` also keeps deploying nothing. */
export const roleOn =
  (role: RoleId, owners: readonly PlayerId[], orNone = false) =>
  (action: Action, context: DecisionContext): boolean =>
    action.type === 'deploy-role' &&
    ((orNone && action.role === null) || (action.role === role && owners.some((o) => shipOf(context, o) === action.targetShipId)));

/** Customs naming `good` on the ship of `aim`. */
export const customsNaming =
  (good: GoodId, aim: PlayerId) =>
  (action: Action, context: DecisionContext): boolean =>
    action.type === 'deploy-role' && action.role === 'customs' && action.namedGood === good && action.targetShipId === shipOf(context, aim);

/** Invest without building, with a load `test` accepts (the empty load means staying in port). */
export const loadWhere =
  (test: (load: Goods) => boolean) =>
  (action: Action): boolean =>
    action.type === 'invest' && test(action.load);

export const unitsOf = units;

/** Diplomat guessing that `role` is aimed at the ship of `owner`. */
export const diplomatGuessing =
  (role: RoleId, owner: PlayerId) =>
  (action: Action, context: DecisionContext): boolean =>
    action.type === 'deploy-role' && action.role === 'diplomat' && action.guessRole === role && action.targetShipId === shipOf(context, owner);
