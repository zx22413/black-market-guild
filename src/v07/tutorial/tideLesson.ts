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
      `每局在第 ${R.v08.events.firstAdvanceFrom}～${R.v08.events.firstAdvanceTo} 回合之間會翻出「暗潮將至」：從這裡的兩種候選中選一種，之後每回合都生效到對局結束。`,
      '這局的候選是風暴潮（最終值 2～3 的船多掉 1 箱）與崩盤潮（跌價加倍）。點晶片可以看效果與擋得住它的東西。這場教學把一局縮成 3 回合。',
    ]),
    step(
      invest(1),
      '押注：早蓋建築',
      [F.materials],
      [
        '修船廠擋風暴潮、商行擋崩盤潮。現在蓋，就算押錯也有平常的效果；等揭曉再蓋比較穩，但能用的回合就少了。',
        '這一課押風暴潮：蓋修船廠。',
      ],
      '選信天翁號，按「裝貨」，裝上 1 香料、1 軍火；再打開「蓋建築」，選修船廠，然後提交。',
      [F.ship('standard'), F.shipNext, F.crate('spice'), F.crate('arms'), F.materials, F.material('repairyard')],
    ),

    // ── Round 2: 暗潮將至 ──
    step(invest(2), '暗潮將至', [F.tide], [
      '這回合翻出的是「暗潮將至」：這回合沒有一般事件，這局的暗潮揭曉了：風暴潮。你押對了。',
      `這回合結束時，每個人倉庫裡每種貨都損失 ${e.warehouseLossPercent}%（無條件捨去）。留在倉庫的貨會少一半，能運的趁現在運出去。`,
    ]),
    step(
      invest(2),
      '趁現在出貨',
      [F.hand],
      ['暗潮季裡，只有跟這局暗潮同類的那張事件卡會翻成更兇的一面：風暴潮對應暴風雨，翻面後所有船 −2。'],
      '選信天翁號，裝上你想賣的貨，然後提交。',
      [F.ship('standard'), F.shipNext],
    ),
    step(market(2), '倉庫減半', [F.rank], ['回合結束時，每座倉庫的每種貨都少了一半。下一回合起是暗潮季。']),

    // ── Round 3: 最後的大市集 ──
    step(invest(3), '最後的大市集', [F.event, F.round], [
      `第 2 張推進牌「最後的大市集」翻出的回合就是最後一回合（一般在第 ${R.v08.events.secondAdvanceFrom}～${R.v08.events.secondAdvanceTo} 回合之間）。`,
      `這回合每種貨需求 +${e.openMarketDemand}、價格不會下跌、每艘船擲 ${e.lastGambleDice} 顆骰取較高的。最後一回合不能選巨鯨號（來不及抵達）。`,
    ]),
    step(
      invest(3),
      '最後一次出航',
      [F.hand],
      ['風暴潮還在：最終值 2～3 的船多掉 1 箱。你有修船廠，風暴潮對你的船無效。'],
      '選信天翁號，裝上你想賣的貨，然後提交。',
      [F.ship('standard'), F.shipNext],
    ),
    step({ kind: 'voyage', round: 3, owners: ['p1', BOT.vande] }, '押對的差別', [F.beat], [
      `你和${vande}的船最終值都是 3。${vande}沒有修船廠：本來掉 ${stormLoss} 箱，風暴潮再多掉 1 箱，船上的 2 箱鐵全掉了。`,
      `你有修船廠：風暴潮對你無效，修船廠再少掉 ${v.repairyard.save} 箱，只掉 ${stormLoss - v.repairyard.save} 箱。`,
    ]),
    step({ kind: 'end' }, '暗潮到這裡', [F.rank], [
      '暗潮一局一種，兩種候選一開局就公開。蓋對應的建築就是押注：早蓋押對最賺，押錯也還有平常的效果。',
      '查緝潮（需求以內的軍火也查扣 1 箱）靠掩護擋；海盜潮（被海盜鎖定的船到港也被搶最貴的 1 箱）沒有建築擋得住。',
    ]),
  ],
};
