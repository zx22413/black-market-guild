import { GOODS, type IslandId, type MatchEvent, type PlayerId, type ShipId, type ShipTypeId, type TideKind, type V08BuildingId, type V08Effect } from '../../v07/game';
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

/** 暗潮將至 took goods from the warehouses at the end of the round before `round`: each island's loss, shown as `round` opens. */
export function tideLossMoments(events: readonly MatchEvent[], round: number, islands: Readonly<Record<PlayerId, IslandId>>): IslandMoment[] {
  return events.flatMap((e): IslandMoment[] => {
    if (e.type !== 'dark-tide-loss' || e.round !== round - 1) return [];
    return Object.entries(e.lost).flatMap(([playerId, lost]): IslandMoment[] => {
      const island = islands[playerId];
      const goods = GOODS.filter((g) => lost[g] > 0);
      if (!island || goods.length === 0) return [];
      const title = '暗潮將至：倉庫的貨被捲走';
      return [{ playerId, island, chips: [{ good: null, text: '暗潮捲走', tone: 'loss', title }, ...goods.map((good) => ({ good, text: `−${lost[good]}`, tone: 'loss' as const, title }))], tone: 'loss' }];
    });
  });
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
  tradehouse: 'tradehouse',
  'crash-shield': 'tradehouse',
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
    case 'tradehouse':
      return `照原價賣 +${value} G`;
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
    return [{ playerId: e.playerId, building, shipId: e.shipId, effect: e.effect, text: `${FACILITY_LABELS[building]}：${reactionText(e.effect, e.crates, e.value)}`, ...(shields ? { shields } : {}) }];
  });
}
