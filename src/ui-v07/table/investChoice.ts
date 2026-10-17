import type { DecisionContext } from '../../v07/bots';
import { BUILDING_IDS, GOODS, buildingCost, capacityFor, shipCostFor, traitOf, type BuildingId, type GoodId, type Goods, type RoleId } from '../../v07/game';
import { BUILDING_LABELS, GOOD_LABELS } from '../labels';
import { legalOf, type ActionOf } from './forms';

// The investment decision (§5 step 2, §8, §10) as plain data, shared by the 2D form and the 3D
// island. What is allowed comes only from the legal actions the runner offered; the reasons and
// reminders below just explain them in words (restating game-design.md, adding no rules).

export const NO_LOAD: Goods = { wood: 0, iron: 0, spice: 0, arms: 0 };

export interface InvestChoice {
  readonly build: BuildingId | null;
  readonly load: Goods;
}

export const EMPTY_CHOICE: InvestChoice = { build: null, load: NO_LOAD };

type InvestAction = ActionOf<'invest'>;

const sameGoods = (a: Goods, b: Goods): boolean => GOODS.every((g) => a[g] === b[g]);
export const unitsOf = (g: Goods): number => GOODS.reduce((n, k) => n + g[k], 0);

export function investOptions(context: DecisionContext): InvestAction[] {
  return legalOf(context, 'invest');
}

const me = (context: DecisionContext) => context.view.players.find((p) => p.id === context.view.playerId)!;

export interface BuildOption {
  readonly id: BuildingId;
  readonly cash: number;
  readonly goods: Goods;
  /** Offered by the legal actions. */
  readonly legal: boolean;
  /** Why it is not offered, for the greyed-out card; null when legal. */
  readonly reason: string | null;
}

/** Every building, offered or not, with the reason it is not (§10.1, §10.2). */
export function buildOptions(context: DecisionContext, options: readonly InvestAction[]): BuildOption[] {
  const { rules, myStock } = context.view;
  const player = me(context);
  const offered = new Set(options.map((a) => a.build));
  return BUILDING_IDS.map((id): BuildOption => {
    const goods = buildingCost(rules, id);
    const cash = rules.buildings.costs[id].cash;
    const legal = offered.has(id);
    const lacking = GOODS.filter((g) => myStock[g] < goods[g]).map((g) => GOOD_LABELS[g]);
    const reason = legal
      ? null
      : player.buildings.includes(id)
        ? '已經有了'
        : player.buildings.length >= rules.buildings.maxPerPlayer
          ? `最多 ${rules.buildings.maxPerPlayer} 棟`
          : lacking.length > 0
            ? `材料不足：${lacking.join('、')}`
            : player.cash < cash
              ? `現金不足（${cash} G）`
              : '這回合不能蓋';
    return { id, cash, goods, legal, reason };
  });
}

/** Can the player still build at all this round (offered at least one building)? */
export const canBuildAny = (options: readonly InvestAction[]): boolean => options.some((a) => a.build !== null);

export function actionFor(options: readonly InvestAction[], choice: InvestChoice): InvestAction | undefined {
  return options.find((a) => a.build === choice.build && sameGoods(a.load, choice.load));
}

/** Choose a building; keeps the cargo when it is still legal with it, otherwise empties the ship. */
export function withBuild(options: readonly InvestAction[], choice: InvestChoice, build: BuildingId | null): InvestChoice {
  const kept = { build, load: choice.load };
  return actionFor(options, kept) ? kept : { build, load: NO_LOAD };
}

/** One more unit of `good` on the ship, if that is still a legal action. */
export function canLoad(options: readonly InvestAction[], choice: InvestChoice, good: GoodId): boolean {
  return actionFor(options, { build: choice.build, load: { ...choice.load, [good]: choice.load[good] + 1 } }) !== undefined;
}

export function loadOne(options: readonly InvestAction[], choice: InvestChoice, good: GoodId): InvestChoice {
  return canLoad(options, choice, good) ? { ...choice, load: { ...choice.load, [good]: choice.load[good] + 1 } } : choice;
}

export function unloadOne(choice: InvestChoice, good: GoodId): InvestChoice {
  return choice.load[good] > 0 ? { ...choice, load: { ...choice.load, [good]: choice.load[good] - 1 } } : choice;
}

/** What the warehouse looks like: goods the building uses, goods on the ship, goods left behind. */
export function stockSplit(context: DecisionContext, choice: InvestChoice): { readonly forBuild: Goods; readonly onShip: Goods; readonly left: Goods } {
  const forBuild = choice.build === null ? NO_LOAD : buildingCost(context.view.rules, choice.build);
  const left = Object.fromEntries(GOODS.map((g) => [g, context.view.myStock[g] - forBuild[g] - choice.load[g]])) as Goods;
  return { forBuild, onShip: choice.load, left };
}

/** Ship capacity with the chosen building (a shipyard built now counts at once, §8). */
export function capacityWith(context: DecisionContext, build: BuildingId | null): number {
  const player = me(context);
  return capacityFor(context.view.rules, build === null ? player.buildings : [...player.buildings, build], player.island);
}

export interface InvestSummary {
  readonly buildCash: number;
  readonly shipCost: number;
  readonly sails: boolean;
  readonly cashBefore: number;
  readonly cashAfter: number;
  readonly loaded: number;
  readonly capacity: number;
}

export function investSummary(context: DecisionContext, choice: InvestChoice): InvestSummary {
  const player = me(context);
  const { rules } = context.view;
  const loaded = unitsOf(choice.load);
  const buildCash = choice.build === null ? 0 : rules.buildings.costs[choice.build].cash;
  const shipCost = shipCostFor(rules, player.island);
  const sails = loaded > 0;
  return { buildCash, shipCost, sails, cashBefore: player.cash, cashAfter: player.cash - buildCash - (sails ? shipCost : 0), loaded, capacity: capacityWith(context, choice.build) };
}

/** What a note shows as icons; the full sentence (`text`) opens on hover or tap. */
export type NoteChip =
  | { readonly kind: 'good'; readonly good: GoodId; readonly count?: number }
  | { readonly kind: 'role'; readonly role: RoleId }
  | { readonly kind: 'ship'; readonly text?: string }
  | { readonly kind: 'coin'; readonly text: string }
  | { readonly kind: 'house' }
  | { readonly kind: 'wanted' }
  | { readonly kind: 'alert' };

/** Reminders shown next to the thing they are about. Each restates a rule; none adds one. */
export interface InvestNote {
  readonly at: 'warehouse' | 'ship';
  readonly text: string;
  readonly chips: readonly NoteChip[];
}

export function investNotes(context: DecisionContext, choice: InvestChoice): InvestNote[] {
  const { view } = context;
  const player = me(context);
  const notes: InvestNote[] = [];
  const split = stockSplit(context, choice);
  if (choice.build !== null) {
    const usedGoods = GOODS.filter((g) => split.forBuild[g] > 0);
    const used = usedGoods.map((g) => `${split.forBuild[g]} ${GOOD_LABELS[g]}`);
    // §8: goods used for a building cannot be loaded.
    if (used.length > 0) {
      notes.push({ at: 'warehouse', text: `蓋${BUILDING_LABELS[choice.build]}會用掉 ${used.join('、')}，不能再裝船`, chips: [{ kind: 'house' }, ...usedGoods.map((good): NoteChip => ({ kind: 'good', good, count: split.forBuild[good] }))] });
    }
    // §8: a shipyard built this round raises the capacity at once.
    if (choice.build === 'shipyard') notes.push({ at: 'ship', text: '造船廠當回合生效：可裝貨量 +1', chips: [{ kind: 'ship', text: '+1' }] });
  }
  // §9.5: another player's guard on an arriving ship confiscates its arms.
  if (choice.load.arms > 0) notes.push({ at: 'ship', text: '軍火抵達時，若有別人的護衛守著會被沒收', chips: [{ kind: 'good', good: 'arms' }, { kind: 'role', role: 'guard' }, { kind: 'alert' }] });
  // §9.6: sinking a ship that carries the wanted player's goods pays the pirates more.
  if (unitsOf(choice.load) > 0 && view.wanted.includes(view.playerId)) {
    notes.push({ at: 'ship', text: '你被通緝：這艘船被擊沉時，海盜的戰利品 +100 G', chips: [{ kind: 'wanted' }, { kind: 'role', role: 'pirate' }, { kind: 'coin', text: `+${view.rules.wanted.lootBonus}` }] });
  }
  // §6.3: spice left in the warehouse spoils at the end of the round (Spice Isles excepted, §11.2).
  if (split.left.spice > 0 && traitOf(view.rules, player.island).keepsSpice === 0) {
    notes.push({ at: 'warehouse', text: `${split.left.spice} 香料沒裝，回合結束會壞掉`, chips: [{ kind: 'good', good: 'spice', count: split.left.spice }, { kind: 'alert' }] });
  }
  return notes;
}

/** The submit button says what is being submitted. */
export function submitLabel(choice: InvestChoice, summary: InvestSummary): string {
  const parts = [choice.build ? `蓋${BUILDING_LABELS[choice.build]}` : null, summary.sails ? `裝 ${summary.loaded} 件出航` : null].filter(Boolean);
  return parts.length > 0 ? `提交：${parts.join('＋')}` : '提交：不蓋也不出航';
}

/** Parts of the decision the player has not dealt with yet: they glow gold until done. */
export interface InvestTodo {
  /** A building could be built and the player has neither picked one nor chosen "不蓋". */
  readonly build: boolean;
  /** Something could be loaded and the ship is still empty (an empty ship stays in port, §8). */
  readonly cargo: boolean;
}

export function investTodo(options: readonly InvestAction[], choice: InvestChoice, buildDecided: boolean): InvestTodo {
  return {
    build: !buildDecided && choice.build === null && canBuildAny(options),
    cargo: unitsOf(choice.load) === 0 && GOODS.some((g) => canLoad(options, choice, g)),
  };
}

/** What the "not finished yet" reminder says before submitting; empty when there is nothing to remind. */
export function todoReminders(todo: InvestTodo): string[] {
  return [
    ...(todo.build ? ['還沒選建築：會不蓋'] : []),
    ...(todo.cargo ? ['船是空的：不出航，也不付出航成本'] : []),
  ];
}
