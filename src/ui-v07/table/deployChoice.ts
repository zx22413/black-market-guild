import type { DecisionContext } from '../../v07/bots';
import { GOODS, GUESSABLE_ROLES, ROLE_IDS, cooldownFor, roleFee, traitOf, type Deployment, type GoodId, type PlayerId, type RoleId, type ShipId } from '../../v07/game';
import { GOOD_LABELS, ROLE_LABELS } from '../labels';
import { legalOf, type ActionOf } from './forms';

// The role deployment (§5 step 3, §9) as plain data, shared by the 2D form and the 3D table. What
// can be chosen comes only from the legal actions; the reasons just explain the greyed cards.

type DeployAction = ActionOf<'deploy-role'>;

/** The role card picked: a role, "不部署" ('none'), or nothing yet (null). */
export type RolePick = RoleId | 'none' | null;

export interface DeployChoice {
  readonly role: RolePick;
  readonly target: ShipId | null;
  /** Customs only: the good it names (§9.4). */
  readonly good: GoodId | null;
  /** Diplomat only: the role it guesses is aimed at its ship (§9.4). */
  readonly guess: RoleId | null;
}

export const EMPTY_DEPLOY: DeployChoice = { role: null, target: null, good: null, guess: null };

export function deployOptions(context: DecisionContext): DeployAction[] {
  return legalOf(context, 'deploy-role');
}

const roleOf = (pick: RolePick): RoleId | null => (pick === 'none' || pick === null ? null : pick);

export interface RoleCard {
  readonly id: RoleId;
  readonly fee: number;
  /** Rounds it rests after a deployment (§9.3). */
  readonly cooldown: number;
  readonly legal: boolean;
  /** Why it cannot be deployed now; null when it can. */
  readonly reason: string | null;
}

/** Every role, deployable or not, with the reason (§9.2 fee, §9.3 cooldown). */
/**
 * Why a role has no ship to act on, said in terms of who sailed: when every role is greyed for this reason it is because
 * nobody's ship is a target (everyone stayed in port), which would otherwise look like a fault to a player who has the
 * money. A freighter still at sea is a target too (roles are pre-deployed on it, game-design.md §8.1).
 */
function noTargetReason(context: DecisionContext, role: RoleId): string {
  const { view } = context;
  const targets = [...view.ships, ...view.transit.filter((s) => s.arriveRound > view.round)];
  if (targets.length === 0) return '這回合沒有船出航，沒有目標';
  if (role === 'customs' && targets.every((s) => s.owner === view.playerId)) return '海關只能針對別人的船，這回合只有你的船出航';
  return '沒有可選的目標';
}

export function roleCards(context: DecisionContext, options: readonly DeployAction[]): RoleCard[] {
  const { view } = context;
  const me = view.players.find((p) => p.id === view.playerId)!;
  return ROLE_IDS.map((id): RoleCard => {
    const fee = roleFee(view.rules, me.island, id);
    const legal = options.some((a) => a.role === id);
    const reason = legal
      ? null
      : !view.myAvailableRoles.includes(id)
        ? `冷卻中，第 ${(me.lastUsed[id] ?? 0) + cooldownFor(view.rules, me.island, id) + 1} 回合可用`
        : me.cash < fee
          ? `現金不足（部署費 ${fee} G）`
          : noTargetReason(context, id);
    return { id, fee, cooldown: cooldownFor(view.rules, me.island, id), legal, reason };
  });
}

/** Ships the chosen role can target. */
export function targetsFor(options: readonly DeployAction[], pick: RolePick): ShipId[] {
  const role = roleOf(pick);
  return [...new Set(options.filter((a) => a.role === role && a.targetShipId !== null).map((a) => a.targetShipId!))];
}

/**
 * Why the role picked cannot be sent to `shipId` (§9.4, §9.5), for the ships that are not on the
 * list of targets; null when it can, or when no role needing a ship is picked. What can be picked
 * still comes only from the legal actions: this only explains the ships left out.
 */
export function blockedReason(context: DecisionContext, options: readonly DeployAction[], choice: DeployChoice, shipId: ShipId): string | null {
  const role = roleOf(choice.role);
  if (role === null || targetsFor(options, choice.role).includes(shipId)) return null;
  const { view } = context;
  const mine = view.ships.find((s) => s.id === shipId)?.owner === view.playerId;
  if (role === 'guard' || role === 'diplomat') return `${ROLE_LABELS[role]}只能守自己的船。`;
  if (role === 'customs') return mine ? '海關只能上別人的船。' : '海關不能派到這艘船。';
  return `${ROLE_LABELS[role]}不能派到這艘船。`;
}

/** What the player still has to name once a ship is picked: customs a good (§9.4), a diplomat a role. */
export const needsNaming = (pick: RolePick): 'good' | 'guess' | null => (pick === 'customs' ? 'good' : pick === 'diplomat' ? 'guess' : null);

export const needsTarget = (pick: RolePick): boolean => pick !== null && pick !== 'none';

export function pickRole(pick: RolePick): DeployChoice {
  return { ...EMPTY_DEPLOY, role: pick };
}

/** Goods customs may name on `shipId` (all four) and roles a diplomat may guess there, as offered by the legal actions. */
export function goodsAtShip(options: readonly DeployAction[], shipId: ShipId): GoodId[] {
  return options.flatMap((a) => (a.role === 'customs' && a.targetShipId === shipId && a.namedGood ? [a.namedGood] : []));
}

export function guessesAtShip(options: readonly DeployAction[], shipId: ShipId): RoleId[] {
  return options.flatMap((a) => (a.role === 'diplomat' && a.targetShipId === shipId && a.guessRole ? [a.guessRole] : []));
}

export function deployActionFor(options: readonly DeployAction[], choice: DeployChoice): DeployAction | undefined {
  if (choice.role === null) return undefined;
  const role = roleOf(choice.role);
  return options.find(
    (a) =>
      a.role === role &&
      a.targetShipId === (needsTarget(choice.role) ? choice.target : null) &&
      a.namedGood === (role === 'customs' ? choice.good : null) &&
      (a.guessRole ?? null) === (role === 'diplomat' ? choice.guess : null),
  );
}

/** Parts still waiting for the player: they glow gold until done. */
export interface DeployTodo {
  readonly role: boolean;
  readonly target: boolean;
  /** The good customs names or the role a diplomat guesses. */
  readonly naming: boolean;
}

export function deployTodo(choice: DeployChoice): DeployTodo {
  const naming = needsNaming(choice.role);
  return {
    role: choice.role === null,
    target: needsTarget(choice.role) && choice.target === null,
    naming: naming === 'good' ? choice.good === null : naming === 'guess' ? choice.guess === null : false,
  };
}

/** The submit button says what is being submitted, e.g. 「部署：海盜 → 黑潮會的船」. */
export function deployLabel(choice: DeployChoice, shipOwner: (id: ShipId) => PlayerId | undefined, nameOf: (id: PlayerId) => string, viewer: PlayerId): string {
  if (choice.role === null) return '提交：不部署';
  if (choice.role === 'none') return '提交：不部署';
  const role = ROLE_LABELS[choice.role];
  if (choice.target === null) return `先點${role}要去的船`;
  const owner = shipOwner(choice.target);
  const ship = owner === viewer ? '你的船' : `${owner ? nameOf(owner) : '?'}的船`;
  if (choice.role === 'customs') return choice.good === null ? '再選要指名的貨' : `部署：海關 → ${ship}，指名${GOOD_LABELS[choice.good]}`;
  if (choice.role === 'diplomat') return choice.guess === null ? '再選要猜的角色' : `部署：外交官 → 猜${ROLE_LABELS[choice.guess]}`;
  return `部署：${role} → ${ship}`;
}

/** Goods in market order and the roles a diplomat may guess, for laying out the naming lists. */
export const ALL_GOODS: readonly GoodId[] = GOODS;
export const ALL_GUESSES: readonly RoleId[] = GUESSABLE_ROLES;

/** What a deployed role named, in words: customs' good, a diplomat's guess; null for the other roles (§9.4). */
export function deploymentNote(d: Pick<Deployment, 'role'> & Partial<Pick<Deployment, 'namedGood' | 'guessRole'>>): string | null {
  if (d.role === 'customs' && d.namedGood) return `指名${GOOD_LABELS[d.namedGood]}`;
  if (d.role === 'diplomat' && d.guessRole) return `猜${ROLE_LABELS[d.guessRole]}`;
  return null;
}
