import { F, R, SEATS, goods, shortRules } from './seats';
import type { TutorialScript } from './types';

// The island draft (§11.1, docs/tutorial-outline.md §7): you pick one of two islands, then every
// island is revealed at once. The lesson ends there, before round 1 is played.

const yard = R.islands.traits.lumber;
const lighthouse = R.islands.traits.lighthouse;
const { offered } = R.islands;

export const ISLANDS: TutorialScript = {
  id: 'islands',
  title: '開局選島',
  summary: '拿到 2 座島、秘密選 1 座，所有人同時公開。',
  seed: 70301,
  rules: shortRules(1),
  seats: [{ ...SEATS[0]!, offer: 'lighthouse' }, ...SEATS.slice(1)],
  youDraft: true,
  showIslandReveal: true,
  rounds: [
    {
      demand: goods({ wood: 2, iron: 1, spice: 2, arms: 1 }),
      event: 'calm-seas',
      // The lesson ends at round 1's investment: it is offered so the last step can wait on it.
      you: { invest: { demo: {}, choose: true, allow: () => true, ready: () => false } },
    },
  ],
  coach: [
    {
      trigger: { kind: 'decision', round: 0, phase: 'island-choice' },
      title: `抽 ${offered} 選 1`,
      focus: [F.draft],
      lines: [
        `開局每人拿到 ${offered} 座島，只有自己看得到。偷偷選 1 座，大家選好後一起翻開。`,
        '選好的島整局都有效。',
      ],
    },
    {
      trigger: { kind: 'decision', round: 0, phase: 'island-choice' },
      title: '每座島都有取捨',
      focus: [F.draft],
      lines: [
        '每座島有好處也有代價，點卡片看說明。',
        `像船塢島，船多裝 ${yard.capacityDelta} 箱，出航卻要多付 ${yard.shipCostDelta} G。燈塔島的船骰 ${R.v08.islands.ownShipMinRaw} 以上會 +${lighthouse.ownShipModifier}，可是最高只到 ${lighthouse.ownShipFinalCap}。`,
      ],
      todo: '選一座島，然後確認。',
    },
    {
      trigger: { kind: 'decision', round: 1, phase: 'invest' },
      title: '同時公開',
      focus: [F.reveal, F.rules],
      lines: [
        '大家的島一起翻開了。之後想查哪座島、角色或建築，按上方的書本鈕。',
      ],
    },
  ],
};
