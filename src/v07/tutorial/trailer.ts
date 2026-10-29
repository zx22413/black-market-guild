import { loadWithin, roleOn } from './allow';
import { BOT, SEATS, goods, shortRules } from './seats';
import type { TutorialScript } from './types';

// Not a lesson: the scripted match the promo trailer is filmed from (src/ui-v07/dev/trailer,
// docs/promo/launch-kit.md §5). It uses the tutorial's machinery only to fix the hidden draws, so
// everything on screen is the real engine playing real actions.
//
// Round 1: everyone ships wood and spice past the demand, and both prices fall.
// Round 2, in a storm: every role at the table lands on your ship. Your 4 takes your own guard
// (+1), a pirate (−1) and the storm (−1) and arrives on a 3, catching the smuggler aboard; 凡德商行's
// 3 is struck by lightning down to a 2 and sinks.

export const TRAILER: TutorialScript = {
  id: 'trailer',
  title: '宣傳片',
  summary: '宣傳片拍攝用的劇本局（不在教學選單裡）。',
  seed: 80101,
  rules: shortRules(2),
  seats: SEATS,
  rounds: [
    {
      demand: goods({ wood: 1, iron: 1, spice: 1, arms: 1 }),
      event: 'calm-seas',
      rolls: { p1: 6, [BOT.vande]: 6, [BOT.tide]: 6, [BOT.anchor]: 6 },
      bots: {
        [BOT.vande]: { load: { wood: 1, spice: 1 } },
        [BOT.tide]: { load: { wood: 1, spice: 1 } },
        [BOT.anchor]: { load: { wood: 1, spice: 1 } },
      },
      you: { invest: { demo: { load: { wood: 1, spice: 1 } }, choose: true, allow: loadWithin({ wood: 1, spice: 1 }) } },
    },
    {
      demand: goods({ wood: 1, iron: 1, spice: 2, arms: 2 }),
      event: 'storm',
      rolls: { p1: 4, [BOT.vande]: 3, [BOT.tide]: 6, [BOT.anchor]: 5 },
      bots: {
        [BOT.vande]: { load: { iron: 2 }, role: ['intel', 'p1'] },
        [BOT.tide]: { load: { spice: 2 }, role: ['pirate', 'p1'] },
        [BOT.anchor]: { load: { arms: 2 }, role: ['smuggler', 'p1'] },
      },
      you: {
        invest: { demo: { load: { wood: 1, iron: 1 } }, choose: false },
        'role-deployment': { demo: { role: ['guard', 'p1'] }, choose: true, allow: roleOn('guard', ['p1']) },
      },
    },
  ],
  coach: [],
};
