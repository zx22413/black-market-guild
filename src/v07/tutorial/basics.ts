import { loadWithin, sailing } from './allow';
import { BOT, F, R, SEATS, goods, nameOf, shortRules } from './seats';
import type { CoachStep, CoachTrigger, FocusTarget, GuideStep, TutorialScript } from './types';

// The guided match (docs/tutorial-outline.md §4): three rounds on the Lumber island that teach
// sailing, the market, goods and the ship types. Roles have lessons of their own (roleScenarios.ts).
//   1 sell · 2 wanted, goods, a storm sinks you, crowded wood falls · 3 the gambler against the albatross, a tailwind
//   and the gambler, the final wealth. V0.8: voyages lose crates (game-design.md §8.1); skills and buildings are the
//   growth lesson (growth.ts), the dark tide its own lesson (tideLesson.ts).

const ROUNDS = 3;
const { successMin, dieMax } = R.sailing;
const ships = R.ships.types;
const harbourTax = R.islands.traits.lumber.shipCostDelta;
const table = R.v08.tables;
const lose = (ship: keyof typeof ships, final: number): number => table[ship].lose[final] ?? 0;
const times = (ship: keyof typeof ships, final: number): number => (table[ship].multiplier[final] ?? 100) / 100;
const vande = nameOf(BOT.vande);
const tide = nameOf(BOT.tide);

const invest = (round: number): CoachTrigger => ({ kind: 'decision', round, phase: 'invest' });
const resolving = (round: number): CoachTrigger => ({ kind: 'resolution', round });
const voyage = (round: number): CoachTrigger => ({ kind: 'voyage', round, owners: ['p1'] });
const market = (round: number): CoachTrigger => ({ kind: 'market', round });
/** A step read on the whole table, before the camera dives to the ship pick (CoachStep.overview). */
const onTable = (s: CoachStep): CoachStep => ({ ...s, overview: true });

const step = (
  trigger: CoachTrigger,
  title: string,
  focus: readonly FocusTarget[],
  lines: readonly string[],
  todo?: string,
  guide?: readonly GuideStep[],
): CoachStep => ({
  trigger,
  title,
  focus,
  lines,
  ...(todo === undefined ? {} : { todo }),
  ...(guide === undefined ? {} : { guide }),
});

export const BASICS: TutorialScript = {
  id: 'basics',
  title: '基礎：出航、買賣與選船',
  summary: '3 回合帶你玩一局：出航、擲骰、黑市價格和選船。',
  seed: 70101,
  rules: shortRules(ROUNDS),
  seats: SEATS,
  rounds: [
    {
      // Round 1: little crowding, your ship arrives (6) and you end the richest.
      demand: goods({ wood: 2, iron: 1, spice: 2, arms: 1 }),
      event: 'calm-seas',
      rolls: { p1: 6 },
      bots: { [BOT.vande]: { load: { iron: 1 } } },
      you: { invest: { demo: { load: { wood: 1, spice: 1 } }, choose: true, allow: loadWithin({ wood: 1, spice: 1 }) } },
    },
    {
      // Round 2: two bots crowd wood past the demand (the storm costs each of them a crate, 2 still arrive); the storm
      // turns your 2 into a 1.
      demand: goods({ wood: 1, iron: 2, spice: 1, arms: 1 }),
      event: 'storm',
      rolls: { p1: 2 },
      bots: { [BOT.vande]: { load: { wood: 2 } }, [BOT.tide]: { load: { wood: 2 } } },
      you: { invest: { demo: { load: { wood: 1, arms: 1 } }, choose: true, allow: loadWithin({ wood: 1, arms: 1 }) } },
    },
    {
      // Round 3: a tailwind lifts your 4 to a 5, and the gambler pays ×1.5.
      demand: goods({ wood: 1, iron: 1, spice: 2, arms: 2 }),
      event: 'tailwind',
      rolls: { p1: 4 },
      bots: { [BOT.anchor]: { load: { iron: 1 } } },
      you: {
        invest: {
          demo: { ship: 'gambler', load: { spice: 1, arms: 2 } },
          choose: true,
          allow: sailing('gambler'),
          // The gambler with any cargo is enough.
          ready: sailing('gambler'),
        },
      },
    },
  ],
  coach: [
    // ── Round 1: sail and sell ──
    onTable(step(invest(1), '歡迎來到暗潮商戰', [F.round], [
      '你有一座島，每回合會產貨。把貨裝船運到巴扎港的黑市賣，最後現金最多的人贏。',
      `這場教學打 ${ROUNDS} 回合。`,
    ])),
    onTable(step(invest(1), '你的島：船塢島', [F.island('p1'), F.plate('p1')], [
      `這是你的島，船塢島。船能多裝 1 箱，但每次出航多付 ${harbourTax} G 港口稅。`,
    ])),
    onTable(step(invest(1), '黑市的價格', [F.market], [
      '上面是黑市的價格，「需」是這回合要收幾箱。',
      '送來的貨比需求少就漲價，多了就跌價。',
    ])),
    step(
      invest(1),
      '選一艘船',
      [F.hand],
      [
        '每回合派一艘船：先挑船，再裝貨。',
        `信天翁號擲 6 全部送到，擲 1 會沉，中間掉 ${lose('standard', 4)}～${lose('standard', 2)} 箱。`,
        '大家同時決定，別人看不到你裝了什麼。',
      ],
      '選信天翁號，按「裝貨」，裝 1 木材、1 香料，然後提交。',
      [F.ship('standard'), F.shipNext, F.crate('wood'), F.crate('spice')],
    ),
    {
      ...step(resolving(1), '航行骰', [], [
        '骰子要到結算才翻開，連你都不知道擲了幾。',
        '事件和角色會加減骰值，算完叫「最終值」，越低掉越多貨。',
      ]),
      diagram: { kind: 'die', successMin, dieMax },
    },
    step(resolving(1), '航海事件', [F.event], [
      '每回合開始會翻一張航海事件，做決定前就看得到。這回合風平浪靜，沒事。',
    ]),
    step(resolving(1), '看結算', [F.log, F.rank], [
      '船會一艘艘揭曉結果，到港的就賣貨。日誌鈕看收支，右上角看排行。',
    ]),
    step(market(1), '價格怎麼動', [F.marketCard], [
      '你擲到 6，兩箱都送到了。',
      '木材、香料送來的比需求少，漲價，香料一次漲兩格；鐵礦剛好，不動。',
    ]),

    // ── Round 2: wanted, goods, a storm ──
    step(invest(2), '通緝令', [F.rank, F.market], [
      `現金最多的人會被通緝，這回合是你。海盜攔下通緝犯的船，會從銀行多領 ${R.wanted.lootBonus} G。`,
    ]),
    step(
      invest(2),
      '四種貨',
      [F.hand],
      [
        '每種貨每回合產 1 箱。香料放到回合結束就壞；軍火最貴，但運超過需求會被查扣。',
        `這回合是暴風雨，每艘船 ${R.voyageEvents.storm}。`,
      ],
      '一樣開信天翁號，裝 1 木材、1 軍火出航。',
      [F.ship('standard'), F.shipNext, F.crate('wood'), F.crate('arms')],
    ),
    step(resolving(2), '暴風雨', [F.event], [
      `暴風雨：每艘船 ${R.voyageEvents.storm}。看你的船撐不撐得住。`,
    ]),
    step(voyage(2), '沉船', [F.beat], [
      '你擲到 2，暴風雨減成 1，信天翁號沉了，貨和船費都沒了。',
      '巨鯨號就不怕：最終值 1 也不沉，只是晚一回合到。',
    ]),
    step(market(2), '大家都運木材', [F.marketCard], [
      `${vande}和${tide}都運木材，送到的比需求多，木材跌了。出航前，猜猜別人會運什麼。`,
    ]),

    // ── Round 3: another ship ──
    step(invest(3), '換艘船試試', [F.ship('standard'), F.ship('gambler')], [
      `孤注號比信天翁號刺激：最終值 5 賣 ×${times('gambler', 5)}、6 賣 ×${times('gambler', 6)}，4 以下整艘沉。`,
      '其他船點船卡就看得到。',
    ]),
    step(
      invest(3),
      '順風下賭一把',
      [F.ship('gambler')],
      [`這回合順風，每艘船 +${R.voyageEvents.tailwind}，孤注號擲 4 就保得住。賭一把吧。`],
      '選孤注號，按「裝貨」，想賣什麼就裝什麼，然後提交。',
      [F.ship('gambler'), F.shipNext, F.crate('arms')],
    ),
    step(resolving(3), '順風', [F.event], [`順風：每艘船 +${R.voyageEvents.tailwind}。`]),
    step(voyage(3), '賭贏了', [F.beat], [
      `擲 4 加順風變 5，孤注號全部送到，賣 ×${times('gambler', 5)}。擲 3 以下就沉了。`,
    ]),
    step({ kind: 'end' }, '總財富', [F.rank], [
      '結束時比現金，倉庫和海上的貨都不算。',
      '教學選單還有成長、暗潮和角色課。',
    ]),
  ],
};
