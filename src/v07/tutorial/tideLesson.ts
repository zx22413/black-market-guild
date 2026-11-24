import type { Action, MaterialAction, Rules } from '../game';
import { sailing, unitsOf } from './allow';
import { BOT, F, R, SEATS, goods, nameOf } from './seats';
import type { CoachStep, CoachTrigger, FocusTarget, GuideStep, TutorialScript } from './types';

// The dark tide lesson (docs/game-design.md §12; docs/tutorial-outline.md §4.3): the event deck on, squeezed into three
// rounds (暗潮將至 in round 2, 最後的大市集 in round 3).
//   1 the two public candidates; you bet on the storm tide with a repairyard
//   2 暗潮將至: no event, the storm tide is picked, half of every warehouse is lost at the round's end
//   3 最後的大市集: the storm tide acts; your 3 loses 1 crate, the rival's 3 without a repairyard loses them all.

const ROUNDS = 3;
const e = R.v08.events;
const v = R.v08;
const REPAIRYARD: MaterialAction = { kind: 'build', building: 'repairyard' };
const vande = nameOf(BOT.vande);

/** The official rules with the event deck's windows squeezed into three rounds. */
const rules: Rules = {
  ...R,
  rounds: ROUNDS,
  v08: { ...v, events: { ...e, firstAdvanceFrom: 2, firstAdvanceTo: 2, secondAdvanceFrom: 3, secondAdvanceTo: 3, maxRounds: ROUNDS } },
};

const invest = (round: number): CoachTrigger => ({ kind: 'decision', round, phase: 'invest' });
const market = (round: number): CoachTrigger => ({ kind: 'market', round });

const step = (trigger: CoachTrigger, title: string, focus: readonly FocusTarget[], lines: readonly string[], todo?: string, guide?: readonly GuideStep[]): CoachStep => ({
  trigger,
  title,
  focus,
  lines,
  ...(todo === undefined ? {} : { todo }),
  ...(guide === undefined ? {} : { guide }),
});

/** Round 1: sail the standard ship with any load, with or without the repairyard (ready only with it). */
const buildAndSail = (a: Action): boolean =>
  a.type === 'invest' &&
  (a.shipType ?? 'standard') === 'standard' &&
  unitsOf(a.load) > 0 &&
  (a.material === undefined || JSON.stringify(a.material) === JSON.stringify(REPAIRYARD)) &&
  a.privateLoad === undefined;
const built = (a: Action): boolean => buildAndSail(a) && a.type === 'invest' && a.material !== undefined;

const stormLoss = v.tables.standard.lose[3] ?? 0;

export const TIDE: TutorialScript = {
  id: 'tide',
  title: '暗潮：押注與最後的大市集',
  summary: '3 回合：暗潮候選、暗潮將至、用建築擋暗潮、最後的大市集。',
  seed: 70802,
  rules,
  seats: SEATS,
  tideCandidates: ['storm', 'crash'],
  rounds: [
    {
      // Round 1: the candidates are public; you build the repairyard and sail; a 6 arrives whole.
      demand: goods({ wood: 1, iron: 1, spice: 2, arms: 1 }),
      event: 'calm-seas',
      rolls: { p1: 6 },
      bots: { [BOT.vande]: { load: { iron: 1 } } },
      you: {
        invest: {
          demo: { material: REPAIRYARD, load: { spice: 1, arms: 1 } },
          choose: true,
          allow: buildAndSail,
          ready: built,
        },
      },
    },
    {
      // Round 2: 暗潮將至 (no event); you ship what you can before half the warehouse is lost.
      demand: goods({ wood: 2, iron: 2, spice: 2, arms: 1 }),
      event: 'advance',
      rolls: { p1: 6 },
      you: { invest: { demo: { load: { iron: 1, spice: 1, arms: 1 } }, choose: true, allow: sailing('standard') } },
    },
    {
      // Round 3: 最後的大市集 under the storm tide; you and 凡德商行 both end on a 3.
      demand: goods({ wood: 1, iron: 1, spice: 1, arms: 1 }),
      event: 'advance',
      rolls: { p1: 3, [BOT.vande]: 3 },
      bots: { [BOT.vande]: { load: { iron: 2 } } },
      you: { invest: { demo: { load: { iron: 1, spice: 1, arms: 1 } }, choose: true, allow: sailing('standard') } },
    },
  ],
  coach: [
    // ── Round 1: the candidates and the bet ──
    step(invest(1), '暗潮候選', [F.tide], [
      `每局第 ${R.v08.events.firstAdvanceFrom}～${R.v08.events.firstAdvanceTo} 回合會翻出「暗潮將至」，從這兩種暗潮揭曉一種，生效到最後。`,
      `這局是風暴潮或崩盤潮，點晶片看效果。教學縮成 ${ROUNDS} 回合，所以來得早。`,
    ]),
    step(
      invest(1),
      '押注：早蓋建築',
      [F.materials],
      [
        '修船廠擋風暴潮，商行擋崩盤潮。現在蓋就是押注，押錯也還有平常的效果。',
        '這課押風暴潮，蓋修船廠。',
      ],
      '選信天翁號，按「裝貨」，裝 1 香料、1 軍火；再打開「蓋建築」選修船廠，然後提交。',
      [F.ship('standard'), F.shipNext, F.crate('spice'), F.crate('arms'), F.materials, F.material('repairyard')],
    ),

    // ── Round 2: 暗潮將至 ──
    step(invest(2), '暗潮將至', [F.tide], [
      '「暗潮將至」翻出來了，這局是風暴潮，你押對了。',
      `這回合結束時，每個倉庫每種貨少 ${e.warehouseLossPercent}%。能運的，趁現在運。`,
    ]),
    step(
      invest(2),
      '趁現在出貨',
      [F.hand],
      [`下回合起是暗潮季，暴風雨會更兇，每艘船 ${e.bossStorm}。`],
      '選信天翁號，裝你想賣的貨，然後提交。',
      [F.ship('standard'), F.shipNext],
    ),
    step(market(2), '倉庫縮水', [F.rank], [`每個倉庫每種貨都少了 ${e.warehouseLossPercent}%。`]),

    // ── Round 3: 最後的大市集 ──
    step(invest(3), '最後的大市集', [F.event, F.round], [
      '「最後的大市集」翻出來，這就是最後一回合。',
      `每種貨需求 +${e.openMarketDemand}、不會跌價，每艘船擲 ${e.lastGambleDice} 顆骰取高的。巨鯨號來不及到，不能選。`,
    ]),
    step(
      invest(3),
      '最後一次出航',
      [F.hand],
      [`風暴潮還在，最終值 ${e.tideStormLossFrom}～${e.tideStormLossTo} 的船要多掉 ${e.tideStormExtraLoss} 箱。你有修船廠，不會多掉。`],
      '選信天翁號，裝你想賣的貨，然後提交。',
      [F.ship('standard'), F.shipNext],
    ),
    step({ kind: 'voyage', round: 3, owners: ['p1', BOT.vande] }, '押對的差別', [F.beat], [
      `你和${vande}最終值都是 3。${vande}沒有修船廠，掉 ${stormLoss} 箱再加風暴潮 ${e.tideStormExtraLoss} 箱，2 箱鐵全沒了。`,
      `你不怕風暴潮，修船廠還幫你少掉 ${v.repairyard.save} 箱，只掉 ${stormLoss - v.repairyard.save} 箱。`,
    ]),
    step({ kind: 'end' }, '暗潮到這裡', [F.rank], [
      '暗潮還有兩種。查緝潮擋得住的是自己的走私商人和幽靈號的技能，海盜潮什麼都擋不住。',
    ]),
  ],
};
