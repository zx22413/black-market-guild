import type { PlayerId, ShipId } from '../../../game';
import { PLAYER_COLORS, type SceneShip, type SceneTable } from '../../scene/tableModel';

/** A fixed mid-round table for the UI mock-up: round 1, role deployment, two ships docked. */

export interface MockSeat {
  readonly name: string;
  readonly cash: number;
  readonly worth: number;
  readonly ready: boolean;
  /** One status badge (layout spec §5); `dot` is the other seat it refers to. */
  readonly status: { readonly text: string; readonly dot: string | null } | null;
}

export const MOCK_SEATS: readonly MockSeat[] = [
  { name: '你', cash: 500, worth: 200, ready: false, status: null },
  { name: '黑潮會', cash: 500, worth: 200, ready: true, status: { text: '應徵', dot: PLAYER_COLORS[3] } },
  { name: '金錨公會', cash: 700, worth: 150, ready: false, status: { text: '留港', dot: null } },
  { name: '北境聯合貿易船運商會', cash: 600, worth: 200, ready: true, status: { text: '應徵', dot: PLAYER_COLORS[0] } },
];

function ship(id: string, owner: string, lane: number): SceneShip {
  return {
    id: id as ShipId,
    kind: 'solo',
    owners: [owner as PlayerId],
    lane,
    state: 'docked',
    roles: [],
    rerolled: false,
    smuggled: 0,
    caughtSmugglers: [],
    modifier: null,
  };
}

export const MOCK_TABLE: SceneTable = {
  seats: MOCK_SEATS.map((s, i) => ({
    id: `p${i}` as PlayerId,
    name: s.name,
    color: PLAYER_COLORS[i]!,
    cash: s.cash,
    assets: i === 2 ? ['shipyard'] : ['salvage'],
    assetValue: s.worth,
    isViewer: i === 0,
    recruiting: null,
    appliedTo: [],
    stayedInPort: false,
  })),
  ships: [ship('r1-s1', 'p0', 0), ship('r1-s2', 'p1', 1)],
};

export const MOCK_EVENTS = {
  market: { name: '黑市懸賞令', effect: '海盜擊沉船時，戰利品 +100 G。', icon: 'market-black-market-bounty' },
  voyage: { name: '部署鎖定後揭曉', icon: 'dice' },
} as const;

/** Role cards in hand; text mirrors rulesText.roleText with RULES_V06 values. */
export const MOCK_HAND = [
  { id: 'intel', name: '情報商人', cost: 50, text: '查看目標船的原始骰值，並決定是否重擲（必須接受新結果）。' },
  { id: 'guard', name: '護衛', cost: 50, text: '目標船骰值 +1；船抵達時查獲他人的走私。' },
  { id: 'pirate', name: '海盜', cost: 100, text: '目標船骰值 −1；船沉沒時與其他海盜均分 150 G 戰利品。' },
  { id: 'smuggler', name: '走私商人', cost: 0, text: '匿名。船抵達且未被查獲時，取走 50 G 存為黑錢；被護衛查獲則罰款 200 G。' },
] as const;
