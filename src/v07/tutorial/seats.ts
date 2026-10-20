import { RULES_V07, type GoodId, type Goods, type PlayerId, type Rules } from '../game';
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

/** The official rules, only with fewer rounds: a tutorial is not a whole match. */
export const shortRules = (rounds: number): Rules => ({ ...RULES_V07, rounds });

export const goods = (partial: Partial<Goods>): Goods => ({ wood: 0, iron: 0, spice: 0, arms: 0, ...partial });

/** Rule numbers quoted in the host's lines, so the words follow the rules when they change. */
export const R = RULES_V07;
export const fee = (role: keyof typeof RULES_V07.roles.fees): number => R.roles.fees[role];

/** Focus targets for the host's steps. */
export const F = {
  market: { kind: 'market' },
  price: (good: GoodId): FocusTarget => ({ kind: 'price', good }),
  island: (player: PlayerId): FocusTarget => ({ kind: 'island', player }),
  plate: (player: PlayerId): FocusTarget => ({ kind: 'plate', player }),
  rank: { kind: 'rank' },
  log: { kind: 'log' },
  round: { kind: 'round' },
  bar: { kind: 'bar' },
  hand: { kind: 'hand' },
  reroll: { kind: 'reroll' },
  draft: { kind: 'draft' },
  reveal: { kind: 'reveal' },
  rules: { kind: 'rules' },
} as const satisfies Record<string, FocusTarget | ((...args: never[]) => FocusTarget)>;
