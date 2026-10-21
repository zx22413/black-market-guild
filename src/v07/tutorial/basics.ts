import { buildThen, loadWithin } from './allow';
import { BOT, F, R, SEATS, goods, nameOf, shortRules } from './seats';
import type { CoachStep, CoachTrigger, FocusTarget, GuideStep, TutorialScript } from './types';

// The guided match (docs/tutorial-outline.md §4): three rounds on the Lumber island that teach
// sailing, the market, goods and buildings. Roles have lessons of their own (roleScenarios.ts).
//   1 sell · 2 wanted, goods, a storm sinks you, crowded wood falls · 3 shipyard, a tailwind, the
//   final wealth.

const ROUNDS = 3;
const shipyard = R.buildings.costs.shipyard;
const { successMin, dieMax } = R.sailing;
const vande = nameOf(BOT.vande);
const tide = nameOf(BOT.tide);

const invest = (round: number): CoachTrigger => ({ kind: 'decision', round, phase: 'invest' });
const resolving = (round: number): CoachTrigger => ({ kind: 'resolution', round });
const voyage = (round: number): CoachTrigger => ({ kind: 'voyage', round, owners: ['p1'] });
const market = (round: number): CoachTrigger => ({ kind: 'market', round });

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
  title: '基礎：出航、買賣與建築',
  summary: '3 回合引導對局：航行骰、黑市價格、貨物與建築。',
  seed: 70101,
  rules: shortRules(ROUNDS),
  seats: SEATS,
  rounds: [
    {
      // Round 1: little crowding, your ship arrives (5) and you end the richest.
      demand: goods({ wood: 2, iron: 1, spice: 2, arms: 1 }),
      event: 'calm-seas',
      rolls: { p1: 5 },
      bots: { [BOT.vande]: { load: { iron: 1 } } },
      you: { invest: { demo: { load: { wood: 1, spice: 1 } }, choose: true, allow: loadWithin({ wood: 1, spice: 1 }) } },
    },
    {
      // Round 2: two bots crowd wood past the demand; the storm turns your 4 into a 3.
      demand: goods({ wood: 1, iron: 2, spice: 1, arms: 1 }),
      event: 'storm',
      rolls: { p1: 4 },
      bots: { [BOT.vande]: { load: { wood: 2 } }, [BOT.tide]: { load: { wood: 1 } } },
      you: { invest: { demo: { load: { wood: 1, spice: 1 } }, choose: true, allow: loadWithin({ wood: 1, spice: 1 }) } },
    },
    {
      // Round 3: you build the shipyard; a tailwind lifts your 3 to a 4.
      demand: goods({ wood: 1, iron: 1, spice: 2, arms: 2 }),
      event: 'tailwind',
      rolls: { p1: 3 },
      bots: { [BOT.anchor]: { load: { arms: 2 } } },
      you: {
        invest: {
          demo: { build: 'shipyard', load: { iron: 2, spice: 1, arms: 1 } },
          choose: true,
          allow: buildThen('shipyard'),
          // Picking the shipyard is enough: loading crates after it is up to you.
          ready: buildThen('shipyard'),
        },
      },
    },
  ],
  coach: [
    // ── Round 1: sail and sell ──
    step(invest(1), '歡迎來到黑市商會', [F.island('p1'), F.plate('p1'), F.round], [
      '你經營一座島：島上生產材料，你決定留下來蓋建築，或裝船運到黑市換錢。',
      `一局打 ${R.rounds} 回合，結束時總財富最高的人獲勝。這場教學只打 ${ROUNDS} 回合；角色另外有單課。`,
    ]),
    step(invest(1), '你的島：林場島', [F.island('p1'), F.plate('p1')], [
      '每座島都有優點和缺點。林場島第 1～5 回合每回合都產木材，但鐵礦只在第 1、4 回合產出。',
      `開局每個人都有 ${R.startingCash} G、${R.startingStock.wood} 木材、${R.startingStock.iron} 鐵礦；每回合開始時，各島把產出放進倉庫。`,
    ]),
    step(invest(1), '黑市：需求卡與價格', [F.market], [
      '上方黑市列是每種貨的現價。每回合翻開一張需求卡，標出這回合黑市要多少貨。',
      '所有船靠港後，到港的貨比需求少就漲價、一樣就不變、比需求多就跌價；香料一次漲跌兩格。抵達的船，用變動後的新價格賣貨。',
    ]),
    step(
      invest(1),
      '出航',
      [F.island('p1')],
      [
        `每回合最多派一艘船：裝了貨就出航，要付出航成本 ${R.shipCost} G，最多裝 ${R.capacity.base} 單位。`,
        '所有人同時、秘密決定：別人只看得到誰出航，看不到船上裝了什麼。',
      ],
      '把 1 木材、1 香料裝上船，然後提交。',
      [F.crate('wood'), F.crate('spice')],
    ),
    {
      ...step(resolving(1), '航行骰', [F.bar], [
        '每艘出航的船擲一顆 1d6，結算時才公開，連船東自己都不知道。',
        '骰值會被航海事件、角色加減，加減完的最終值決定船的生死。',
      ]),
      diagram: { kind: 'die', successMin, dieMax },
    },
    step(resolving(1), '航海事件', [F.event], [
      '每回合還會翻開一張航海事件，在大家決定之後才公開，影響所有船的最終值。',
      '這回合是「風平浪靜」，沒有效果。',
    ]),
    step(resolving(1), '看結算', [F.log, F.rank], [
      '接下來每艘船依序揭曉骰值與結果，抵達的船再到黑市賣貨。',
      '頂部的日誌鈕可以回看每一筆收支；右上角的排行是目前的總財富。',
    ]),
    step(market(1), '價格怎麼動', [F.marketCard], [
      '你的船擲出 5，平安抵達。木材和香料到港的量都比需求少，所以漲價（香料一次漲兩格）；鐵礦到港量剛好等於需求，價格不變。',
      '抵達的貨都用變動後的新價格賣出。',
    ]),

    // ── Round 2: wanted, goods, a storm ──
    step(invest(2), '通緝令', [F.plate('p1'), F.market], [
      '每回合開始時，現金最多的玩家被通緝。你上回合賺最多，所以這回合你被通緝了。',
      `載著通緝者貨物的船被海盜擊沉時，海盜多拿 ${R.wanted.lootBonus} G 戰利品。海盜在角色單課裡介紹。`,
    ]),
    step(
      invest(2),
      '四種貨',
      [F.island('p1')],
      ['木材、鐵礦可以蓋建築，也可以賣；香料和軍火只能賣。', '香料放不住：回合結束時還在倉庫裡就壞掉。軍火賣得最貴，但可能被別人的護衛沒收。'],
      '再裝木材、香料出航一次。',
      [F.crate('wood'), F.crate('spice')],
    ),
    step(resolving(2), '暴風雨', [F.event], [
      `這回合翻到暴風雨：所有船 ${R.voyageEvents.storm}。航海事件在大家決定之後才公開，誰都來不及調整。`,
      '看看你的船撐不撐得住。',
    ]),
    step(voyage(2), '沉船', [F.beat], [
      `你的船原始骰值是 4，本來能抵達，暴風雨 ${R.voyageEvents.storm} 後變 3，沉了。沉沒的船貨全沒了，出航成本也不退。`,
    ]),
    step(market(2), '大家都運木材', [F.marketCard], [
      `${vande}和${tide}都運了木材，到港量超過需求，木材跌價。`,
      '大家擠同一種貨，價格就會崩：猜別人會運什麼，是這個遊戲的核心。',
    ]),

    // ── Round 3: buildings ──
    step(invest(3), '建築', [F.build('shipyard')], [
      `投資時每回合可以蓋一棟建築，每人最多 ${R.buildings.maxPerPlayer} 棟、每種一棟，蓋好當回合就生效。`,
      `造船廠：${shipyard.cash} G＋${shipyard.wood} 木材，可裝貨量 +${R.capacity.shipyardBonus}。`,
    ]),
    step(
      invest(3),
      '留下來蓋，還是運出去賣',
      [F.build('shipyard')],
      ['建造在裝貨之前：蓋建築用掉的材料，就不能再裝船。', '每一單位材料都要選：留著蓋建築，或運到黑市換錢。'],
      '打開建築清單，選造船廠（之後想裝貨出航也可以，這回合可裝 4 單位）。',
      [F.build('shipyard')],
    ),
    step(resolving(3), '順風', [F.event], [`這回合是順風：所有船 +${R.voyageEvents.tailwind}。`]),
    step(voyage(3), '順風救了你', [F.beat], [
      `有出航的話，你的船原始骰值只有 3，靠順風 +${R.voyageEvents.tailwind} 變成 4 才抵達。`,
    ]),
    step({ kind: 'end' }, '總財富', [F.rank], [
      `對局結束時比總財富：現金＋持有建築現金成本的 ${R.buildings.valueRatio * 100}%。倉庫裡剩下的材料不計分。`,
      '基礎到這裡結束。接下來可以從教學選單學各個角色。',
    ]),
  ],
};
