import type { Action, Goods, MaterialAction } from '../game';
import { unitsOf } from './allow';
import { F, R, SEATS, goods, shortRules } from './seats';
import type { CoachStep, CoachTrigger, FocusTarget, GuideStep, TutorialScript } from './types';

// The growth lesson (docs/game-design.md §8.2, §10; docs/tutorial-outline.md §4.2): two rounds on the Shipyard island.
//   1 the material action: build the repairyard, and a 3 that would lose 2 crates loses only 1
//   2 open the gambler's skill and raise: a 6 arrives at ×4.

const ROUNDS = 2;
const v = R.v08;
const REPAIRYARD: MaterialAction = { kind: 'build', building: 'repairyard' };
const OPEN_GAMBLER: MaterialAction = { kind: 'open', ship: 'gambler' };

const invest = (round: number): CoachTrigger => ({ kind: 'decision', round, phase: 'invest' });
const voyage = (round: number): CoachTrigger => ({ kind: 'voyage', round, owners: ['p1'] });

const step = (trigger: CoachTrigger, title: string, focus: readonly FocusTarget[], lines: readonly string[], todo?: string, guide?: readonly GuideStep[]): CoachStep => ({
  trigger,
  title,
  focus,
  lines,
  ...(todo === undefined ? {} : { todo }),
  ...(guide === undefined ? {} : { guide }),
});

const cost = (c: Goods): string =>
  [c.wood > 0 ? `${c.wood} 木材` : '', c.iron > 0 ? `${c.iron} 鐵礦` : '', c.spice > 0 ? `${c.spice} 香料` : '', c.arms > 0 ? `${c.arms} 軍火` : ''].filter(Boolean).join('、');
const same = (a: MaterialAction | undefined, b: MaterialAction): boolean => JSON.stringify(a ?? null) === JSON.stringify(b);
const within = (load: Goods, max: Partial<Goods>): boolean => (Object.keys(load) as (keyof Goods)[]).every((g) => load[g] <= (max[g] ?? 0));

/** Sail `ship` with a load within `max`, with no material action or the scripted one (so the table can add it last). */
const sailWith =
  (ship: 'standard' | 'gambler', max: Partial<Goods>, material: MaterialAction, raise: 'any' | 'never') =>
  (a: Action): boolean =>
    a.type === 'invest' &&
    (a.shipType ?? 'standard') === ship &&
    unitsOf(a.load) > 0 &&
    within(a.load, max) &&
    (a.material === undefined || same(a.material, material)) &&
    (raise === 'any' || a.raise !== true) &&
    a.privateLoad === undefined;

const done =
  (ship: 'standard' | 'gambler', material: MaterialAction, raise: boolean) =>
  (a: Action): boolean =>
    a.type === 'invest' && (a.shipType ?? 'standard') === ship && unitsOf(a.load) > 0 && same(a.material, material) && (a.raise === true) === raise;

const saved = (v.tables.standard.lose[3] ?? 0) - v.repairyard.save;

export const GROWTH: TutorialScript = {
  id: 'growth',
  title: '成長：建築與船技能',
  summary: '2 回合：用材料蓋修船廠、開啟孤注號的加注。',
  seed: 70801,
  rules: shortRules(ROUNDS),
  seats: SEATS,
  rounds: [
    {
      // Round 1: you build the repairyard and sail spice and arms; a 3 loses 2 crates, the repairyard saves one.
      demand: goods({ wood: 1, iron: 1, spice: 2, arms: 1 }),
      event: 'calm-seas',
      rolls: { p1: 3 },
      you: {
        invest: {
          demo: { material: REPAIRYARD, load: { spice: 1, arms: 1 } },
          choose: true,
          allow: sailWith('standard', { spice: 1, arms: 1 }, REPAIRYARD, 'never'),
          ready: done('standard', REPAIRYARD, false),
        },
      },
    },
    {
      // Round 2: you open the gambler's skill with 2 iron and raise; a 6 arrives at ×4.
      demand: goods({ wood: 2, iron: 1, spice: 2, arms: 1 }),
      event: 'calm-seas',
      rolls: { p1: 6 },
      you: {
        invest: {
          demo: { ship: 'gambler', material: OPEN_GAMBLER, raise: true, load: { wood: 1, spice: 1, arms: 1 } },
          choose: true,
          allow: sailWith('gambler', { wood: 1, spice: 1, arms: 1 }, OPEN_GAMBLER, 'any'),
          ready: done('gambler', OPEN_GAMBLER, true),
        },
      },
    },
  ],
  coach: [
    // ── Round 1: build ──
    step(invest(1), '材料不只能賣', [F.stock], [
      '倉庫裡的木材和鐵礦可以賣，也可以拿來讓自己變強。投資時每回合最多做一個「材料行動」，在裝貨之前從倉庫扣掉。',
      `材料行動有兩種：開啟一種船的技能（${cost(v.costs.open)}，最多開 ${v.maxSkills} 種船），或蓋一棟建築（${cost(v.costs.build.repairyard)}，一局只能蓋 ${v.maxBuildings} 棟）。做了什麼在提交後公開。`,
    ]),
    step(
      invest(1),
      '蓋修船廠',
      [F.materials],
      [
        '三棟建築各擋一種傷害：修船廠擋天災（骰子），軍械庫擋人禍（海盜），商行擋市場（價格）。',
        `修船廠讓你的船最終值 ${v.repairyard.fromFinal}～${v.repairyard.toFinal} 時少掉 ${v.repairyard.save} 箱。蓋了就一直有效，這回合出航的船就適用。`,
      ],
      '選信天翁號，按「裝貨」，裝上 1 香料、1 軍火；再打開「蓋建築」，選修船廠，然後提交。',
      [F.ship('standard'), F.shipNext, F.crate('spice'), F.crate('arms'), F.materials, F.material('repairyard')],
    ),
    step(voyage(1), '少掉 1 箱', [F.beat], [
      `你的船擲出 3。信天翁號最終值 3 本來掉 ${v.tables.standard.lose[3] ?? 0} 箱，修船廠讓你只掉 ${saved} 箱：掉的是船上最貴的軍火，香料到港。`,
      '建築要在出事之前蓋：越早蓋，用得越久；但蓋了就少了能賣的材料。',
    ]),

    // ── Round 2: a ship skill ──
    step(
      invest(2),
      '船技能',
      [F.ship('gambler')],
      [
        '每種船都有一個技能，開了之後，開那種船出航時才有效：信天翁號重擲、孤注號加注、巨鯨號拾荒、幽靈號自帶掩護、海嘯號巨浪。',
        `孤注號的技能是「加注」：出航時可以宣告加注，只有最終值 ${v.raise.minFinal} 才到港，到港時 ×${v.raise.multiplier / 100}。宣告是公開的，大家都看得到你在賭。`,
      ],
      `選孤注號，在說明卡的技能列按「開啟」（${cost(v.costs.open)}），按「裝貨」，裝上 1 木材、1 香料、1 軍火，再打開船上的「加注」，然後提交。`,
      [F.ship('gambler'), F.skill('gambler'), F.shipNext, F.crate('wood'), F.crate('spice'), F.crate('arms'), F.raise],
    ),
    step(voyage(2), '賭贏了', [F.beat], [`你擲出 6，加注的孤注號全部到港，賣 ×${v.raise.multiplier / 100}。擲出 5 以下的話，這艘船就沉了。`]),
    step({ kind: 'end' }, '成長到這裡', [F.rank], [
      '技能是你冒險的方式，建築是你為這局做的準備。開了哪種船的技能、蓋了哪棟建築都公開，可以看對手怎麼押。',
      '下一課「暗潮」會講建築另一個用處：擋住這局的暗潮。',
    ]),
  ],
};
