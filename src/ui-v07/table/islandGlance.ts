import type { GoodId, IslandId, RoleId } from '../../v07/game';

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
    { sign: -1, icon: good('spice'), text: '漲價只吃一半' },
  ],
  'pirate-cove': [
    { sign: 1, icon: role('pirate'), text: '−2（一般 −1）' },
    { sign: -1, icon: role('guard'), text: '部署費 +25 G' },
  ],
  lumber: [
    { sign: 1, icon: good('wood'), text: '第 1～5 回合生產' },
    { sign: -1, icon: good('iron'), text: '只在第 1、4 回合' },
  ],
  mine: [
    { sign: 1, icon: good('iron'), text: '第 1～5 回合生產' },
    { sign: -1, icon: good('wood'), text: '只在第 1、4 回合' },
  ],
  'smuggler-port': [
    { sign: 1, icon: good('arms'), text: '每回合生產' },
    { sign: -1, icon: good('arms'), text: '不能被掩護' },
    { sign: -1, icon: role('guard'), text: '部署費 +50 G' },
  ],
  'free-port': [
    { sign: 1, icon: ship, text: '出航成本 50 G' },
    { sign: -1, icon: ship, text: '可裝貨量 −1' },
  ],
  fortress: [
    { sign: 1, icon: role('guard'), text: '+2（一般 +1）・冷卻 1' },
    { sign: -1, icon: role('pirate'), text: '部署費 +25 G' },
  ],
  lighthouse: [
    { sign: 1, icon: ship, text: '出航 +1' },
    { sign: 1, icon: role('intel'), text: '免費・多看一艘' },
    { sign: -1, icon: ship, text: '出航成本 +50 G' },
  ],
};
