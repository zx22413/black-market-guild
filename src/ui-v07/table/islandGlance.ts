import type { GoodId, IslandId, RoleId, Rules } from '../../v07/game';

// What each island does, as a few icon-and-number items for a quick look. This is only a summary
// for the screen: the sentences in ISLAND_TEXT (docs/game-design.md §11.2) stay the rule text and
// are what the player reads on hover or tap, so keep the two in step.

export type GlanceIcon = { readonly kind: 'good'; readonly good: GoodId } | { readonly kind: 'role'; readonly role: RoleId } | { readonly kind: 'ship' };

export interface GlanceItem {
  /** A bonus (+) or a drawback (−). */
  readonly sign: 1 | -1;
  readonly icon: GlanceIcon;
  /** A few characters at most. */
  readonly text: string;
}

const good = (g: GoodId): GlanceIcon => ({ kind: 'good', good: g });
const role = (r: RoleId): GlanceIcon => ({ kind: 'role', role: r });
const ship: GlanceIcon = { kind: 'ship' };

export const ISLAND_GLANCE: Readonly<Record<IslandId, readonly GlanceItem[]>> = {
  'spice-isles': [
    { sign: 1, icon: good('spice'), text: '不壞・每回合 +1' },
    { sign: 1, icon: good('spice'), text: '賣價高 1 格' },
    { sign: -1, icon: ship, text: '載香料 +25 G' },
  ],
  'pirate-cove': [
    { sign: 1, icon: role('pirate'), text: '−2（一般 −1）' },
    { sign: -1, icon: role('guard'), text: '部署費 +25 G' },
  ],
  lumber: [
    { sign: 1, icon: ship, text: '可裝貨量 +1' },
    { sign: -1, icon: ship, text: '每艘船 +25 G' },
  ],
  mine: [
    { sign: 1, icon: good('iron'), text: '每回合 +1' },
    { sign: -1, icon: good('wood'), text: '只在第 1、4 回合' },
  ],
  'smuggler-port': [
    { sign: 1, icon: good('arms'), text: '每回合 +1' },
    { sign: 1, icon: ship, text: '幽靈號船費 0' },
    { sign: -1, icon: good('arms'), text: '軍火不能被掩護' },
    { sign: -1, icon: role('guard'), text: '部署費 +50 G' },
  ],
  'free-port': [
    { sign: 1, icon: ship, text: '孤注號船費 0' },
    { sign: -1, icon: ship, text: '可裝貨量 −1' },
  ],
  fortress: [
    { sign: 1, icon: role('guard'), text: '+2（一般 +1）・冷卻 1' },
    { sign: -1, icon: role('pirate'), text: '部署費 +25 G' },
  ],
  lighthouse: [
    { sign: 1, icon: ship, text: '出航 +1' },
    { sign: 1, icon: role('customs'), text: '海關免費' },
    { sign: -1, icon: ship, text: '最終值最大 5' },
  ],
};

/** The glance items under `rules`: the V0.8 prototype (rules.v08.islands, not rules) changes the free port and the lighthouse. */
export function islandGlance(rules: Rules, island: IslandId): readonly GlanceItem[] {
  const { freePortFeePercent, ownShipMinRaw } = rules.v08.islands;
  if (island === 'free-port' && freePortFeePercent > 0) {
    return [{ sign: 1, icon: ship, text: freePortFeePercent === 50 ? '所有船費減半' : `船費只付 ${freePortFeePercent}%` }];
  }
  if (island === 'lighthouse' && ownShipMinRaw > 0) {
    return ISLAND_GLANCE.lighthouse.map((item, i) => (i === 0 ? { ...item, text: `出航 +1（骰 ${ownShipMinRaw} 以上）` } : item));
  }
  return ISLAND_GLANCE[island];
}
