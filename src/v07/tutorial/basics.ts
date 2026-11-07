import { loadWithin, sailing } from './allow';
import { BOT, F, R, SEATS, goods, nameOf, shortRules } from './seats';
import type { CoachStep, CoachTrigger, FocusTarget, GuideStep, TutorialScript } from './types';

// The guided match (docs/tutorial-outline.md §4): three rounds on the Lumber island that teach
// sailing, the market, goods and the ship types. Roles have lessons of their own (roleScenarios.ts).
//   1 sell · 2 wanted, goods, a storm sinks you, crowded wood falls · 3 the five ships, a tailwind
//   and the gambler, the final wealth.

const ROUNDS = 3;
const { successMin, dieMax } = R.sailing;
const ships = R.ships.types;
const harbourTax = R.islands.traits.lumber.shipCostDelta;
const yardCapacity = R.capacity.base + R.islands.traits.lumber.capacityDelta;
const pct = (ship: keyof typeof ships, final: number): number => ships[ship].curve[final] ?? 0;
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
  title: '基礎：出航、買賣與選船',
  summary: '3 回合引導對局：航行骰、黑市價格、貨物與五種船。',
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
      // Round 2: two bots crowd wood past the demand; the storm turns your 2 into a 1.
      demand: goods({ wood: 1, iron: 2, spice: 1, arms: 1 }),
      event: 'storm',
      rolls: { p1: 2 },
      bots: { [BOT.vande]: { load: { wood: 2 } }, [BOT.tide]: { load: { wood: 1 } } },
      you: { invest: { demo: { load: { wood: 1, arms: 1 } }, choose: true, allow: loadWithin({ wood: 1, arms: 1 }) } },
    },
    {
      // Round 3: a tailwind lifts your 4 to a 5, and the gambler pays 125%.
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
    step(invest(1), '歡迎來到暗潮商戰', [F.round], [
      '你經營一座島：島上每回合生產材料，你決定要不要選一艘船、裝上貨，運到中央巴扎港的黑市換錢。',
      `一局打 ${R.rounds} 回合，結束時現金最多的人獲勝。這場教學只打 ${ROUNDS} 回合；角色另外有單課。`,
    ]),
    step(invest(1), '你的島：船塢島', [F.rank], [
      `船塢島的優點是你的船可以多裝 1 單位（共 ${yardCapacity} 單位），缺點是每艘船出航要另付 ${harbourTax} G 港口稅。`,
      `開局每個人都有 ${R.startingCash} G、${R.startingStock.wood} 木材、${R.startingStock.iron} 鐵礦；每回合開始時，各島每種貨各生產 1 單位放進倉庫。`,
    ]),
    step(invest(1), '黑市：需求卡與價格', [F.market], [
      '上方黑市列是每種貨的現價。每回合翻開一張需求卡，標出這回合黑市要多少貨。',
      '所有船靠港後，到港的貨比需求少就漲價、一樣就不變、比需求多就跌價；香料一次漲跌兩格。抵達的船，用變動後的新價格賣貨。',
    ]),
    step(
      invest(1),
      '選一艘船',
      [F.hand],
      [
        '每回合最多派一艘船：先選船型，再從倉庫選貨裝上去。五種船各有船費、載量與收入曲線，之後會一一介紹；先用最基本的信天翁號。',
        `信天翁號沒有船費（你的島另收 ${harbourTax} G 港口稅），最終值 1 會沉，2 拿貨值的 ${pct('standard', 2)}%，6 拿 ${pct('standard', 6)}%。`,
        '所有人同時、秘密決定：別人只看得到誰出航、開什麼船，看不到船上裝了什麼。',
      ],
      '選信天翁號，按「裝貨」，把 1 木材、1 香料裝上船，然後提交。',
      [F.ship('standard'), F.shipNext, F.crate('wood'), F.crate('spice')],
    ),
    {
      ...step(resolving(1), '航行骰', [], [
        '每艘出航的船擲一顆 1d6，結算時才公開，連船東自己都不知道。',
        '骰值會被航海事件、角色加減，加減完的最終值，對照船的收入曲線決定結果：曲線上是 0 就沉沒。',
      ]),
      diagram: { kind: 'die', successMin, dieMax },
    },
    step(resolving(1), '航海事件', [F.event], [
      '每回合開始時還會翻開一張航海事件，投資和部署角色之前就公開，影響所有船的最終值。',
      '這回合是「風平浪靜」，沒有效果。',
    ]),
    step(resolving(1), '看結算', [F.log, F.rank], [
      '接下來每艘船依序揭曉骰值與結果，抵達巴扎港的船再到黑市賣貨。',
      '頂部的日誌鈕可以回看每一筆收支；右上角的排行是目前的總財富。',
    ]),
    step(market(1), '價格怎麼動', [F.marketCard], [
      `你的船擲出 6，平安抵達，信天翁號拿到全部貨值（最終值越低，拿到的比例越少：2 只拿 ${pct('standard', 2)}%）。木材和香料到港的量都比需求少，所以漲價（香料一次漲兩格）；鐵礦到港量剛好等於需求，價格不變。`,
      '抵達的貨都用變動後的新價格賣出。',
    ]),

    // ── Round 2: wanted, goods, a storm ──
    step(invest(2), '通緝令', [F.rank, F.market], [
      '每回合開始時，現金最多的玩家被通緝。你上回合賺最多，所以這回合你被通緝了。',
      `海盜攔下通緝者的船時，多拿 ${R.wanted.lootBonus} G（銀行付）。海盜在角色單課裡介紹。`,
    ]),
    step(
      invest(2),
      '四種貨',
      [F.hand],
      [
        '木材、鐵礦、香料、軍火都只能賣，不能用來蓋東西。每回合每種貨都會再生產 1 單位，倉庫沒有上限。',
        '香料放不住：回合結束時還在倉庫裡就壞掉。軍火賣得最貴，海關可能指名沒收它。',
        '這回合的航海事件是暴風雨：所有船 −1。事件在投資前就公開，你可以依它決定開哪艘船、裝什麼。',
      ],
      '一樣用信天翁號，裝 1 木材、1 軍火出航。',
      [F.ship('standard'), F.shipNext, F.crate('wood'), F.crate('arms')],
    ),
    step(resolving(2), '暴風雨', [F.event], [
      `暴風雨：所有船 ${R.voyageEvents.storm}。看看你的船撐不撐得住。`,
    ]),
    step(voyage(2), '沉船', [F.beat], [
      `你的船原始骰值是 2，本來能抵達，暴風雨 ${R.voyageEvents.storm} 後變 1，沉了：信天翁號最終值 1 就沉。沉沒的船貨全沒了，船費也不退。`,
      '遇到暴風雨，其他船型可能更穩：巨鯨號最終值 1 也不會沉，只是要下一回合才抵達。',
    ]),
    step(market(2), '大家都運木材', [F.marketCard], [
      `${vande}和${tide}都運了木材，到港量超過需求，木材跌價。`,
      '大家擠同一種貨，價格就會崩：猜別人會運什麼，是這個遊戲的核心。',
    ]),

    // ── Round 3: the five ships ──
    step(invest(3), '五種船', [F.ship('standard'), F.ship('gambler'), F.ship('freighter'), F.ship('hidden'), F.ship('breaker')], [
      `信天翁號是基準。孤注號船費 ${ships.gambler.fee} G，最終值 4 以下全沉，5 拿 ${pct('gambler', 5)}%、6 拿 ${pct('gambler', 6)}%，用過要休息 ${ships.gambler.cooldown} 回合。`,
      `巨鯨號不會沉、載量 +${ships.freighter.capacity}，但下一回合才抵達，收入比例也低。幽靈號船費 ${ships.hidden.fee} G，海關指名它的貨無效。海嘯號的最終值不封頂，加成越疊越賺。`,
      '點每張船卡可以看它的曲線；沒有最好的船，要看事件、貨量和對手會派什麼角色。',
    ]),
    step(
      invest(3),
      '順風下賭一把',
      [F.ship('gambler')],
      [
        `這回合是順風：所有船 +${R.voyageEvents.tailwind}。孤注號平常要擲到 5 才不沉，順風下只要原始骰值 4 以上就有 ${pct('gambler', 5)}% 以上的收入，擲 5 以上更有 ${pct('gambler', 6)}%。`,
        '高風險換高報酬：船費貴、沉了貨全沒，但賺得多。',
      ],
      '選孤注號，按「裝貨」，裝上你想賣的貨（貨量不限），然後提交。',
      [F.ship('gambler'), F.shipNext, F.crate('arms')],
    ),
    step(resolving(3), '順風', [F.event], [`順風：所有船 +${R.voyageEvents.tailwind}。看看孤注號的賭局。`]),
    step(voyage(3), '賭贏了', [F.beat], [
      `你的船原始骰值 4，順風 +${R.voyageEvents.tailwind} 變 5，孤注號拿到貨值的 ${pct('gambler', 5)}%。要是擲出 3 以下，這艘船就沉了。`,
    ]),
    step({ kind: 'end' }, '總財富', [F.rank], [
      '對局結束時比總財富，也就是現金。倉庫裡剩下的材料不計分，海上還沒抵達的貨也不算。',
      '基礎到這裡結束。接下來可以從教學選單學各個角色。',
    ]),
  ],
};
