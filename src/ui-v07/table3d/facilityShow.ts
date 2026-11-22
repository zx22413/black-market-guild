import { GOODS, type GoodId, type IslandId, type MatchEvent, type PlayerId, type ShipId, type ShipTypeId, type TideKind, type V08BuildingId, type V08Effect } from '../../v07/game';
import { SHIP_TYPE_LABELS } from '../labels';
import { FACILITY_LABELS, SKILL_LABELS } from '../table/v08Text';
import type { IslandMoment } from './islandMoments';

// V0.8 prototype (an experiment, not rules): what the table says when a building goes up or a ship skill opens, and when
// a building does its work during the round's resolution. Built from public events only; the numbers are the engine's.

/** The round's material actions as island moments: 「修船廠 落成」, 「信天翁號・好兆頭 開啟」. */
export function materialMoments(events: readonly MatchEvent[], round: number, islands: Readonly<Record<PlayerId, IslandId>>): IslandMoment[] {
  return events.flatMap((e): IslandMoment[] => {
    if (e.type !== 'materials-used' || e.round !== round) return [];
    return e.uses.flatMap((use): IslandMoment[] => {
      const island = islands[use.playerId];
      if (!island) return [];
      const m = use.material;
      const chip =
        m.kind === 'build'
          ? { good: null, text: `${FACILITY_LABELS[m.building]} 落成`, tone: 'gain' as const, title: `蓋了${FACILITY_LABELS[m.building]}` }
          : { good: null, text: `${SKILL_LABELS[m.ship]} 開啟`, tone: 'gain' as const, title: `開啟${SHIP_TYPE_LABELS[m.ship]}的技能「${SKILL_LABELS[m.ship]}」` };
      return [{ playerId: use.playerId, island, chips: [chip], tone: 'gain' }];
    });
  });
}

/** Who raised a building in `round` (the launch moment then brings the camera to the islands that have something to show). */
export function buildersOf(events: readonly MatchEvent[], round: number): PlayerId[] {
  return events.flatMap((e) => (e.type === 'materials-used' && e.round === round ? e.uses.filter((u) => u.material.kind === 'build').map((u) => u.playerId) : []));
}

/** Who opened a ship skill in `round`, and for which ship type (the dock works unveil that ship at the launch). */
export function skillOpenersOf(events: readonly MatchEvent[], round: number): { readonly playerId: PlayerId; readonly ship: ShipTypeId }[] {
  return events.flatMap((e) =>
    e.type === 'materials-used' && e.round === round ? e.uses.flatMap((u) => (u.material.kind === 'open' ? [{ playerId: u.playerId, ship: u.material.ship }] : [])) : [],
  );
}

/**
 * The dock works at the launch: round every ship launched in `round` whose own skill was opened in that round. The
 * others' ships are unveiled (`launch`); the viewer's own, which they watched being built, only goes back under
 * (`strike`). A skill opened for a ship type that did not sail has no ship at the dock to show it on.
 */
export function launchWorks(
  events: readonly MatchEvent[],
  round: number,
  ships: readonly { readonly id: ShipId; readonly owner: PlayerId; readonly type?: ShipTypeId; readonly fromEarlier?: boolean }[],
  viewer: PlayerId | null,
): Map<ShipId, { mode: 'launch' | 'strike'; key: string; skill: boolean }> {
  const works = new Map<ShipId, { mode: 'launch' | 'strike'; key: string; skill: boolean }>();
  for (const { playerId, ship } of skillOpenersOf(events, round)) {
    const docked = ships.find((s) => s.owner === playerId && s.type === ship && !s.fromEarlier);
    if (docked) works.set(docked.id, { mode: playerId === viewer ? 'strike' : 'launch', key: `launch-${round}-${playerId}`, skill: true });
  }
  return works;
}

/** Two lists of moments as one, a player's chips joined (the launch's island chips, then the material action's). */
export function mergeMoments(a: readonly IslandMoment[], b: readonly IslandMoment[]): IslandMoment[] {
  const out = a.map((m) => ({ ...m }));
  for (const m of b) {
    const i = out.findIndex((o) => o.playerId === m.playerId);
    if (i < 0) out.push({ ...m });
    else out[i] = { ...out[i]!, chips: [...out[i]!.chips, ...m.chips], tone: out[i]!.tone === 'gain' || m.tone === 'gain' ? 'gain' : 'loss' };
  }
  return out;
}

/** A building at work: whose, which, on which ship (null: at the market), and the line over its island. */
export interface FacilityReaction {
  readonly playerId: PlayerId;
  readonly building: V08BuildingId;
  readonly shipId: ShipId | null;
  readonly effect: V08Effect;
  readonly text: string;
  /** Crates the effect is about (the repair yard's kept crates, the tradehouse's shielded ones); 0 when it is about money. */
  readonly crates: number;
  /** The tide this building just turned away for its owner (the shield effects), else absent. */
  readonly shields?: TideKind;
}

/** The effects that are a building turning its tide away. */
export const SHIELD_OF: Partial<Record<V08Effect, TideKind>> = { 'storm-shield': 'storm', 'pirate-shield': 'pirate', 'crash-shield': 'crash' };

const BUILDING_OF: Partial<Record<V08Effect, V08BuildingId>> = {
  repairyard: 'repairyard',
  'storm-shield': 'repairyard',
  armory: 'armory',
  'pirate-toll': 'armory',
  'customs-halved': 'armory',
  'pirate-shield': 'armory',
  // The ship left with arms aboard: the tower's guns cover it, at the guard step its +1 is in (ESCORT_EFFECTS).
  'armory-armed': 'armory',
  'armory-counter': 'armory',
  tradehouse: 'tradehouse',
  'crash-shield': 'tradehouse',
  'tradehouse-premium': 'tradehouse',
  'tradehouse-buyout': 'tradehouse',
};

function reactionText(effect: V08Effect, crates: number, value: number): string {
  switch (effect) {
    case 'repairyard':
      return `少掉 ${crates} 箱`;
    case 'storm-shield':
      return '擋下風暴潮';
    case 'armory':
      return `海盜少拿 ${value} G`;
    case 'pirate-toll':
      return `收海盜部署費 ${value} G`;
    case 'customs-halved':
      return `保住 ${crates} 箱`;
    case 'pirate-shield':
      return '擋下海盜潮';
    case 'armory-armed':
      return '砲台護航';
    case 'armory-counter':
      return `擊退海盜 +${value} G`;
    case 'tradehouse':
      return `照原價賣 +${value} G`;
    case 'tradehouse-premium':
      return `最貴 ${crates} 箱高一格賣 +${value} G`;
    case 'tradehouse-buyout':
      return `收購剩貨 +${value} G`;
    case 'crash-shield':
      return '擋下崩盤潮';
    default:
      return '';
  }
}

/** The buildings that did something in `round`, in event order. */
export function facilityReactions(events: readonly MatchEvent[], round: number): FacilityReaction[] {
  return events.flatMap((e): FacilityReaction[] => {
    if (e.type !== 'v08-effect' || e.round !== round) return [];
    const building = BUILDING_OF[e.effect];
    if (!building) return [];
    const shields = SHIELD_OF[e.effect];
    return [{ playerId: e.playerId, building, shipId: e.shipId, effect: e.effect, text: `${FACILITY_LABELS[building]}：${reactionText(e.effect, e.crates, e.value)}`, crates: e.crates, ...(shields ? { shields } : {}) }];
  });
}

/**
 * The effects the settlement plays as a show of the building's own, in among the flights of the ship they are about
 * (the armory's guns, the tradehouse's seal): the money they are about moves there. The repair yard's are about the
 * voyage and play with the ship's outcome, and so does the armory's counter-fire (its pirates are driven off, and pay,
 * before the die is read).
 */
export const SETTLED_EFFECTS: ReadonlySet<V08Effect> = new Set<V08Effect>(['armory', 'pirate-toll', 'customs-halved', 'pirate-shield', 'tradehouse', 'crash-shield', 'tradehouse-premium', 'tradehouse-buyout']);

/**
 * The effects that play at the ship's guard step, where their bonus is on the die (the armory's guns covering an armed
 * ship). The event does not say whether the bonus counted (v08.armory.armedMaxFinal can hold it back): the show goes
 * by the ship having a guard step that raised the die.
 */
export const ESCORT_EFFECTS: ReadonlySet<V08Effect> = new Set<V08Effect>(['armory-armed']);

/** The settlement flight a building's show goes in front of (the money it changed), by effect. */
export const WORK_BEFORE: Partial<Record<V08Effect, string>> = { armory: 'pirate-loot', 'pirate-shield': 'pirate-loot', 'customs-halved': 'goods-confiscated', tradehouse: 'sale', 'crash-shield': 'sale', 'tradehouse-premium': 'sale', 'tradehouse-buyout': 'tradehouse-buyout' };

/** Most crates a building's show puts on screen. */
const SHOWN_CRATES = 3;

/**
 * The crates a building's show puts on screen, from what the round made public: the good the tradehouse owner named,
 * the ship's other goods for the crash-tide shield, the crate the tradehouse bought out of the warehouse, the ship's
 * cargo for the crates the repair yard kept. Empty for the effects that are about money only. (老字號's crates are the
 * ship's highest-priced ones, which the events do not name: as many crates of its cargo stand in for them.)
 */
export function workGoods(events: readonly MatchEvent[], round: number, r: Pick<FacilityReaction, 'playerId' | 'shipId' | 'effect' | 'crates'>): GoodId[] {
  const named = events.flatMap((e) => (e.type === 'trade-protected' && e.round === round ? [e.protect[r.playerId]] : []))[0];
  const cargo = events.flatMap((e) => (e.type === 'ship-resolved' && e.round === round && e.shipId === r.shipId ? [e.cargo] : []))[0];
  const loaded = (goods: readonly GoodId[]): GoodId[] => goods.flatMap((g) => Array.from({ length: cargo?.[g] ?? 0 }, () => g));
  switch (r.effect) {
    case 'tradehouse':
      return named === undefined ? [] : [named, ...loaded([named]).slice(1, SHOWN_CRATES)];
    case 'crash-shield':
      return loaded(GOODS.filter((g) => g !== named)).slice(0, Math.min(SHOWN_CRATES, Math.max(1, r.crates)));
    case 'tradehouse-buyout':
      return events.flatMap((e) => (e.type === 'leftover-bought' && e.round === round && e.playerId === r.playerId ? [e.good] : [])).slice(0, 1);
    case 'tradehouse-premium':
    case 'repairyard':
      return loaded(GOODS).slice(0, Math.min(SHOWN_CRATES, r.crates));
    default:
      return [];
  }
}
