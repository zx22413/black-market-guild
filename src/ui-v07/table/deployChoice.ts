import type { DecisionContext } from '../../v07/bots';
import { GOODS, ROLE_IDS, cooldownFor, roleFee, type Bet, type PlayerId, type RoleId, type ShipId } from '../../v07/game';
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
  /** Lighthouse intel only: the optional second ship to look at (§11.2). */
  readonly peek: ShipId | null;
  readonly bet: Bet | null;
}

export const EMPTY_DEPLOY: DeployChoice = { role: null, target: null, peek: null, bet: null };

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
          : '沒有可選的目標';
    return { id, fee, cooldown: cooldownFor(view.rules, me.island, id), legal, reason };
  });
}

/** Ships the chosen role can target. */
export function targetsFor(options: readonly DeployAction[], pick: RolePick, bet: Bet | null = null): ShipId[] {
  const role = roleOf(pick);
  // The broker's ships depend on the bet picked (a bull bet may only aim at one's own ship).
  const fits = (a: DeployAction) => role !== 'broker' || bet === null || (a.bet?.good === bet.good && a.bet?.direction === bet.direction);
  return [...new Set(options.filter((a) => a.role === role && a.targetShipId !== null && fits(a)).map((a) => a.targetShipId!))];
}

/** Lighthouse intel: ships that can be looked at besides the target. */
export function peeksFor(options: readonly DeployAction[], choice: DeployChoice): ShipId[] {
  return [
    ...new Set(options.filter((a) => a.role === 'intel' && a.targetShipId === choice.target && a.peekShipId !== null).map((a) => a.peekShipId!)),
  ];
}

/** Broker bets on offer (§9.4). */
export function betsFor(options: readonly DeployAction[]): Bet[] {
  const bets = options.flatMap((a) => (a.role === 'broker' && a.bet ? [a.bet] : []));
  // The same bet is offered once per ship it may name (§9.4); the market shows it once.
  return bets.filter((b, i) => bets.findIndex((x) => x.good === b.good && x.direction === b.direction) === i);
}

/** §9.4: the broker's bet also names a ship (for the bet picked, once there is one). */
export const brokerAims = (options: readonly DeployAction[], bet: Bet | null = null): boolean =>
  options.some((a) => a.role === 'broker' && a.targetShipId !== null && (bet === null || (a.bet?.good === bet.good && a.bet?.direction === bet.direction)));

export const needsTarget = (pick: RolePick, aims = false): boolean => pick !== null && pick !== 'none' && (pick !== 'broker' || aims);

export function pickRole(pick: RolePick): DeployChoice {
  return { ...EMPTY_DEPLOY, role: pick };
}

export function deployActionFor(options: readonly DeployAction[], choice: DeployChoice): DeployAction | undefined {
  if (choice.role === null) return undefined;
  const role = roleOf(choice.role);
  return options.find(
    (a) =>
      a.role === role &&
      a.targetShipId === (needsTarget(choice.role, brokerAims(options, choice.bet)) ? choice.target : null) &&
      a.peekShipId === choice.peek &&
      (role === 'broker' ? a.bet?.good === choice.bet?.good && a.bet?.direction === choice.bet?.direction : true),
  );
}

/** Parts still waiting for the player: they glow gold until done. */
export interface DeployTodo {
  readonly role: boolean;
  readonly target: boolean;
  readonly bet: boolean;
}

export function deployTodo(choice: DeployChoice, aims = false): DeployTodo {
  return {
    role: choice.role === null,
    target: needsTarget(choice.role, aims) && choice.target === null,
    bet: choice.role === 'broker' && choice.bet === null,
  };
}

export const betLabel = (bet: Bet): string => `${GOOD_LABELS[bet.good]}${bet.direction === 1 ? '漲' : '跌'}`;

/** The submit button says what is being submitted, e.g. 「部署：海盜 → 黑潮會的船」. */
export function deployLabel(choice: DeployChoice, shipOwner: (id: ShipId) => PlayerId | undefined, nameOf: (id: PlayerId) => string, viewer: PlayerId, aims = false): string {
  if (choice.role === null) return '提交：不部署';
  if (choice.role === 'none') return '提交：不部署';
  const role = ROLE_LABELS[choice.role];
  if (choice.role === 'broker') {
    if (!choice.bet) return '先在黑市選商品與漲跌';
    if (!aims) return `部署：莊家 → 押${betLabel(choice.bet)}`;
    const owner = choice.target === null ? undefined : shipOwner(choice.target);
    return choice.target === null ? '再點一艘對手的船' : `部署：莊家 → 押${betLabel(choice.bet)}，對象 ${owner ? nameOf(owner) : '?'}的船`;
  }
  if (choice.target === null) return `先點${role}要去的船`;
  const owner = shipOwner(choice.target);
  const ship = owner === viewer ? '你的船' : `${owner ? nameOf(owner) : '?'}的船`;
  return `部署：${role} → ${ship}`;
}

/** Bets in market order, both directions, for laying out the broker's choices. */
export const ALL_BETS: readonly Bet[] = GOODS.flatMap((good) => [
  { good, direction: 1 as const },
  { good, direction: -1 as const },
]);
