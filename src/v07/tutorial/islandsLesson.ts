import { F, SEATS, goods, shortRules } from './seats';
import type { TutorialScript } from './types';

// The island draft (§11.1, docs/tutorial-outline.md §7): you pick one of two islands, then every
// island is revealed at once. The lesson ends there, before round 1 is played.

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
      you: { invest: { demo: {}, choose: true, allow: () => true } },
    },
  ],
  coach: [
    {
      trigger: { kind: 'decision', round: 0, phase: 'island-choice' },
      title: '抽 2 選 1',
      focus: [F.draft],
      lines: [
        '開局前，每個人拿到 2 座島，只有自己看得到。每人秘密選 1 座，所有人選定後同時公開；沒選的島不使用。',
        '選定的島整局生效，第 1 回合的生產就照這座島計算。',
      ],
    },
    {
      trigger: { kind: 'decision', round: 0, phase: 'island-choice' },
      title: '每座島都有取捨',
      focus: [F.draft],
      lines: [
        '每座島都有一個優點、一個缺點。點卡片可以看完整說明。',
        '林場島木材產得多，適合蓋建築；燈塔島自己的船 +1、情報商人免費，但出航成本較高。',
      ],
      todo: '選一座島，然後確認。',
    },
    {
      trigger: { kind: 'decision', round: 1, phase: 'invest' },
      title: '同時公開',
      focus: [F.reveal, F.rules],
      lines: [
        '所有人的島同時公開。八座島大致分三類：產能型（林場島、礦山島、香料群島、走私港）、航運型（自由港、燈塔島）、對抗型（海盜灣、要塞島）。',
        '對局中隨時可以按頂部的書本鈕，查每座島、角色與建築的規則。',
      ],
    },
  ],
};
