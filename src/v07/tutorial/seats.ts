import { RULES_CURRENT, RULES_V07, type GoodId, type Goods, type PlayerId, type RoleId, type Rules, type ShipTypeId, type V08BuildingId } from '../game';
import type { FocusTarget, TutorialSeat } from './types';

// The table every tutorial uses: you on the Lumber island (docs/tutorial-outline.md §4), three
// bots on islands whose traits do not touch the scripted dice.

export const SEATS: readonly TutorialSeat[] = [
  { name: '你', island: 'lumber' },
  { name: '凡德商行', island: 'mine' },
  { name: '黑潮會', island: 'spice-isles' },
  { name: '金錨公會', island: 'smuggler-port' },
];

export const BOT = { vande: 'p2', tide: 'p3', anchor: 'p4' } as const;
export const nameOf = (id: string): string => SEATS[Number(id.slice(1)) - 1]?.name ?? id;

/**
 * The official rules (V0.8), only with a fixed, shorter length: a tutorial is not a whole match, so the event deck that
 * sets the length (and brings the dark tide) is off. The dark tide lesson turns it back on with its own windows.
 */
export const shortRules = (rounds: number): Rules => ({
  ...RULES_CURRENT,
  rounds,
  v08: { ...RULES_CURRENT.v08, events: { ...RULES_CURRENT.v08.events, enabled: 0, tides: 0 } },
});

/** The promo video still plays the V0.7.1 ship bays it was shot with (src/ui-v07/dev/trailer). */
export const trailerRules = (rounds: number): Rules => ({ ...RULES_V07, rounds });

export const goods = (partial: Partial<Goods>): Goods => ({ wood: 0, iron: 0, spice: 0, arms: 0, ...partial });

/** Rule numbers quoted in the host's lines, so the words follow the rules when they change. */
export const R = RULES_CURRENT;
export const fee = (role: keyof typeof RULES_CURRENT.roles.fees): number => R.roles.fees[role];

/** Focus targets for the host's steps. */
export const F = {
  market: { kind: 'market' },
  price: (good: GoodId): FocusTarget => ({ kind: 'price', good }),
  island: (player: PlayerId): FocusTarget => ({ kind: 'island', player }),
  plate: (player: PlayerId): FocusTarget => ({ kind: 'plate', player }),
  ship: (ship: ShipTypeId): FocusTarget => ({ kind: 'ship', ship }),
  shipNext: { kind: 'ship-next' },
  role: (role: RoleId | 'none'): FocusTarget => ({ kind: 'role', role }),
  target: (player: PlayerId): FocusTarget => ({ kind: 'target', player }),
  naming: (value: string): FocusTarget => ({ kind: 'naming', value }),
  crate: (good: GoodId, count = 1): FocusTarget => ({ kind: 'crate', good, count }),
  restock: (good: GoodId): FocusTarget => ({ kind: 'restock', good }),
  rank: { kind: 'rank' },
  log: { kind: 'log' },
  round: { kind: 'round' },
  bar: { kind: 'bar' },
  hand: { kind: 'hand' },
  draft: { kind: 'draft' },
  reveal: { kind: 'reveal' },
  rules: { kind: 'rules' },
  submit: { kind: 'submit' },
  event: { kind: 'event' },
  beat: { kind: 'beat' },
  marketCard: { kind: 'market-card' },
  advance: { kind: 'advance' },
  materials: { kind: 'materials' },
  material: (building: V08BuildingId): FocusTarget => ({ kind: 'material', building }),
  skill: (ship: ShipTypeId): FocusTarget => ({ kind: 'skill', ship }),
  raise: { kind: 'raise' },
  tide: { kind: 'tide' },
  stock: { kind: 'stock' },
} as const satisfies Record<string, FocusTarget | ((...args: never[]) => FocusTarget)>;
