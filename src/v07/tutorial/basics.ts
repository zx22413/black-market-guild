import { betOn, buildThen, loadWhere, loadWithin, rerollOrKeep, roleOn, unitsOf } from './allow';
import { BOT, F, R, SEATS, fee, goods, nameOf, shortRules } from './seats';
import type { CoachStep, CoachTrigger, FocusTarget, TutorialScript } from './types';

// The guided match (docs/tutorial-outline.md §4–§6): a whole six-round match on the Lumber island.
// Rounds 1–3 teach sailing, the market, goods and buildings; from round 2 on, each round also
// teaches one role, every role used once so no cooldown gets in the way:
//   1 sell · 2 storm, crowding, guard · 3 shipyard, pirate · 4 intel · 5 smuggler (and a bot's
//   arms cover) · 6 broker, then the final wealth.
// Wood: the Lumber island stops producing wood after round 5, and round 6 sails one wood for the
// broker's bet, so rounds 4 and 5 keep their wood in the warehouse.

const ROUNDS = 6;
const shipyard = R.buildings.costs.shipyard;
const { successMin, dieMax } = R.sailing;
const { guard, pirate, smuggler, broker } = R.roles;
const vande = nameOf(BOT.vande);
const tide = nameOf(BOT.tide);

const invest = (round: number): CoachTrigger => ({ kind: 'decision', round, phase: 'invest' });
const deploy = (round: number): CoachTrigger => ({ kind: 'decision', round, phase: 'role-deployment' });
const resolving = (round: number): CoachTrigger => ({ kind: 'resolution', round });

const step = (trigger: CoachTrigger, title: string, focus: readonly FocusTarget[], lines: readonly string[], todo?: string): CoachStep => ({
  trigger,
  title,
  focus,
  lines,
  ...(todo === undefined ? {} : { todo }),
});

const noWood = loadWhere((l) => l.wood === 0 && unitsOf(l) > 0);
const noWoodOrStay = loadWhere((l) => l.wood === 0);
const oneWood = loadWhere((l) => l.wood === 1);

export const BASICS: TutorialScript = {
  id: 'basics',
  title: '完整教學：一整局',
  summary: '6 回合引導對局：出航、黑市價格、貨物、建築，以及五個角色。',
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
      // Round 2: two bots crowd wood; the storm turns your 4 into a 3, your guard brings it back to 4;
      // the unguarded 3 of 黑潮會 sinks.
      demand: goods({ wood: 1, iron: 2, spice: 1, arms: 1 }),
      event: 'storm',
      rolls: { p1: 4, [BOT.tide]: 3 },
      bots: { [BOT.vande]: { load: { wood: 2 } }, [BOT.tide]: { load: { wood: 1 } } },
      you: {
        invest: { demo: { load: { wood: 1, spice: 1 } }, choose: true, allow: loadWithin({ wood: 1, spice: 1 }) },
        'role-deployment': { demo: { role: ['guard', 'p1'] }, choose: true, allow: roleOn('guard', ['p1']) },
      },
    },
    {
      // Round 3: you build the shipyard; a tailwind lifts your 3, and your pirate sinks 凡德商行's 3 anyway.
      demand: goods({ wood: 1, iron: 1, spice: 2, arms: 2 }),
      event: 'tailwind',
      rolls: { p1: 3, [BOT.vande]: 3 },
      bots: { [BOT.vande]: { load: { iron: 1 } }, [BOT.anchor]: { load: { arms: 2 } } },
      you: {
        invest: {
          demo: { build: 'shipyard', load: { iron: 2, spice: 1, arms: 1 } },
          choose: true,
          allow: buildThen('shipyard'),
          ready: (a) => a.type === 'invest' && unitsOf(a.load) > 0,
        },
        'role-deployment': { demo: { role: ['pirate', BOT.vande] }, choose: true, allow: roleOn('pirate', [BOT.vande]) },
      },
    },
    {
      // Round 4: your intel sees a 2 on your own ship; a reroll brings a 5. 凡德商行's wood meets the
      // demand, so wood stops climbing (round 6 needs room above it for the broker's ship).
      demand: goods({ wood: 1, iron: 2, spice: 1, arms: 1 }),
      event: 'calm-seas',
      rolls: { p1: 2, [BOT.vande]: 5 },
      rerolls: { p1: 5 },
      bots: { [BOT.vande]: { load: { wood: 1, iron: 1 } } },
      you: {
        invest: { demo: { load: { iron: 1, spice: 1 } }, choose: true, allow: noWood, ready: noWood },
        'role-deployment': { demo: { role: ['intel', 'p1'] }, choose: true, allow: roleOn('intel', ['p1']) },
        'intel-reroll': { demo: { reroll: 'p1' }, choose: true, allow: rerollOrKeep },
      },
    },
    {
      // Round 5: you smuggle on 凡德商行's unguarded ship; 凡德商行 guards 黑潮會's ship to seize its
      // arms, but 黑潮會 covers them with its own smuggler. 黑潮會's wood floods the market.
      demand: goods({ wood: 1, iron: 2, spice: 2, arms: 1 }),
      event: 'black-market-rush',
      rolls: { [BOT.vande]: 5, [BOT.tide]: 5 },
      bots: {
        [BOT.vande]: { load: { iron: 1 }, role: ['guard', BOT.tide] },
        [BOT.tide]: { load: { wood: 2, arms: 1 }, role: ['smuggler', BOT.tide] },
      },
      you: {
        invest: { demo: { load: { spice: 1, arms: 1 } }, choose: true, allow: noWoodOrStay, ready: noWoodOrStay },
        'role-deployment': {
          demo: { role: ['smuggler', BOT.vande] },
          choose: true,
          allow: roleOn('smuggler', [BOT.vande, BOT.tide]),
          ready: roleOn('smuggler', [BOT.vande, BOT.tide]),
        },
      },
    },
    {
      // Round 6: you sail one wood and bet it rises; the bet lifts wood demand to 2, only yours arrives.
      demand: goods({ wood: 1, iron: 1, spice: 2, arms: 1 }),
      event: 'calm-seas',
      rolls: { p1: 5 },
      bots: { [BOT.vande]: { load: { iron: 1 } } },
      you: {
        invest: { demo: { load: { wood: 1, spice: 1 } }, choose: true, allow: oneWood, ready: oneWood },
        'role-deployment': {
          demo: { bet: { good: 'wood', direction: 1, aim: 'p1' } },
          choose: true,
          allow: betOn({ good: 'wood', direction: 1 }, 'p1'),
        },
      },
    },
  ],
  coach: [
    // ── Round 1: sail and sell ──
    step(invest(1), '歡迎來到黑市商會', [F.island('p1'), F.plate('p1'), F.round], [
      '你經營一座島：島上生產材料，你決定留下來蓋建築，或裝船運到黑市換錢。',
      `一局打 ${R.rounds} 回合，結束時總財富最高的人獲勝。這場教學就是完整的一局，每回合教一點新東西。`,
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
      [F.island('p1'), F.bar],
      [
        `每回合最多派一艘船：裝了貨就出航，要付出航成本 ${R.shipCost} G，最多裝 ${R.capacity.base} 單位。`,
        '所有人同時、秘密決定：別人只看得到誰出航，看不到船上裝了什麼。',
      ],
      '把 1 木材、1 香料裝上船，然後提交。',
    ),
    step(resolving(1), '航行骰', [F.island('p1'), F.bar], [
      `每艘出航的船擲一顆 1d6，結算時才公開，連船東自己都不知道。最終值 ${successMin}～${dieMax} 抵達，1～${successMin - 1} 沉沒。`,
      '每回合還會翻開一張航海事件，在大家決定之後才公開。這回合是「風平浪靜」，沒有效果。',
    ]),
    step(resolving(1), '看結算', [F.log, F.rank], [
      '接下來每艘船依序揭曉骰值與結果，抵達的船再到黑市賣貨。',
      '頂部的日誌鈕可以回看每一筆收支；右上角的排行是目前的總財富。',
    ]),

    // ── Round 2: wanted, goods, the guard ──
    step(invest(2), '上回合', [F.price('wood'), F.price('spice')], [
      '你的船擲出 5，平安抵達。木材和香料的到港量都比需求少，所以漲價，你的貨用漲價後的新價格賣出。',
    ]),
    step(invest(2), '通緝令', [F.plate('p1'), F.market], [
      '每回合開始時，現金最多的玩家被通緝。你上回合賺最多，所以這回合你被通緝了。',
      `載著通緝者貨物的船被海盜擊沉時，海盜多拿 ${R.wanted.lootBonus} G 戰利品。`,
    ]),
    step(
      invest(2),
      '四種貨',
      [F.island('p1'), F.bar],
      ['木材、鐵礦可以蓋建築，也可以賣；香料和軍火只能賣。', '香料放不住：回合結束時還在倉庫裡就壞掉。軍火賣得最貴，但可能被別人的護衛沒收。'],
      '再裝木材、香料出航一次。',
    ),
    step(deploy(2), '部署角色', [F.hand], [
      '投資之後，所有人同時、秘密選一個角色派出去，也可以不派；不出航也能派。角色在大家都決定後一次揭露。',
      `每個角色有部署費，用過之後要冷卻 ${R.roles.cooldown} 回合才能再派。`,
    ]),
    step(
      deploy(2),
      '護衛',
      [F.hand, F.island('p1')],
      [
        `護衛守一艘船，讓它的航行骰 +${guard.modifier}。你看不到自己的骰值，派護衛是押注：抵達的機會從一半提高到三分之二。`,
        `守別人的船、而那艘船抵達時，還能從銀行拿 ${guard.escortFee} G 護航費。`,
      ],
      `派護衛守自己的船（部署費 ${fee('guard')} G）。`,
    ),
    step(resolving(2), '暴風雨', [F.island('p1'), F.bar], [
      `這回合翻到暴風雨：所有船 ${R.voyageEvents.storm}。航海事件在大家決定之後才公開，誰都來不及調整。`,
      '看看你的船，和其他人的船撐不撐得住。',
    ]),

    // ── Round 3: buildings, the pirate ──
    step(invest(3), '上回合：護衛救了你', [F.island('p1'), F.island(BOT.tide)], [
      `你的船原始骰值 4，暴風雨 ${R.voyageEvents.storm} 變 3，護衛 +${guard.modifier} 又回到 4，抵達。`,
      `${tide}的船沒有護衛：原始 3，暴風雨後變 2，沉了。沉沒的船貨全沒了，出航成本也不退。`,
    ]),
    step(invest(3), '上回合：大家都運木材', [F.price('wood'), F.island(BOT.vande)], [
      `${vande}和你都運了木材，到港量超過需求，木材跌價。`,
      '大家擠同一種貨，價格就會崩：猜別人會運什麼，是這個遊戲的核心。',
    ]),
    step(invest(3), '建築', [F.island('p1')], [
      `投資時每回合可以蓋一棟建築，每人最多 ${R.buildings.maxPerPlayer} 棟、每種一棟，蓋好當回合就生效。`,
      `造船廠：${shipyard.cash} G＋${shipyard.wood} 木材，可裝貨量 +${R.capacity.shipyardBonus}。`,
    ]),
    step(
      invest(3),
      '留下來蓋，還是運出去賣',
      [F.island('p1'), F.bar],
      ['建造在裝貨之前：蓋建築用掉的材料，就不能再裝船。', '每一單位材料都要選：留著蓋建築，或運到黑市換錢。'],
      '蓋造船廠，再裝貨出航（這回合可裝 4 單位）。',
    ),
    step(deploy(3), '冷卻', [F.hand], [`護衛上回合用過，要冷卻 ${R.roles.cooldown} 回合：第 5 回合才能再派。手牌上灰掉的角色會寫出原因。`]),
    step(
      deploy(3),
      '海盜',
      [F.hand, F.island(BOT.vande)],
      [
        `海盜鎖定一艘船，讓它 ${pirate.modifier}。那艘船沉沒時，銀行付 ${pirate.loot} G 戰利品，由鎖定它的海盜平分。`,
        `船上載著通緝者的貨時，戰利品再多 ${R.wanted.lootBonus} G。`,
      ],
      `派海盜鎖定${vande}的船（部署費 ${fee('pirate')} G）。`,
    ),
    step(resolving(3), '順風', [F.island(BOT.vande), F.bar], [
      `這回合是順風：所有船 +${R.voyageEvents.tailwind}。看看海盜的 ${pirate.modifier} 抵不抵得過順風。`,
    ]),

    // ── Round 4: the intel merchant ──
    step(invest(4), '上回合：擊沉', [F.island(BOT.vande), F.plate('p1')], [
      `${vande}的船原始骰值 3，順風 +${R.voyageEvents.tailwind}、海盜 ${pirate.modifier}，還是 3，沉沒，戰利品歸你。`,
      '小心航海事件「海霧」：被海盜鎖定的船 +1，海盜反而幫了對手。',
    ]),
    step(
      invest(4),
      '留著木材',
      [F.island('p1'), F.bar],
      ['林場島第 6 回合不產木材，最後一回合會用到 1 木材。這回合和下回合先別裝木材，把它留在倉庫。'],
      '不裝木材，裝其他貨出航。',
    ),
    step(
      deploy(4),
      '情報商人',
      [F.hand, F.island('p1')],
      ['情報商人鎖定一艘船，看它的原始骰值，再決定要不要重擲；重擲就必須接受新結果。', '做決定時，你還不知道航海事件，也不知道別人派了什麼角色。'],
      `派情報商人看自己的船（部署費 ${fee('intel')} G）。`,
    ),
    step(
      { kind: 'decision', round: 4, phase: 'intel-reroll' },
      '只有你看得到',
      [F.reroll],
      ['你的船原始骰值是 2，照這樣會沉。要不要重擲，由你決定。'],
      '選擇重擲，或維持原本的骰值。',
    ),
    step(resolving(4), '看結算', [F.island('p1'), F.bar], ['角色揭露時，大家都看得到哪艘船被重擲，但原本的骰值永遠只有你知道。']),

    // ── Round 5: the smuggler, and arms ──
    step(
      invest(5),
      '上回合：重擲',
      [F.island('p1'), F.bar],
      ['重擲的話新骰值是 5，船抵達；維持 2 的話就沉了。', '這回合一樣先別裝木材。要不要出航都可以：下一個角色不必自己出航。'],
      '不裝木材；出航或留在港裡都可以。',
    ),
    step(
      deploy(5),
      '走私商人',
      [F.hand, F.island(BOT.vande), F.island(BOT.tide)],
      [
        `走私商人搭別人的船夾帶私貨，部署費 ${fee('smuggler')} G。船抵達、船上沒有護衛時，你從船東的賣貨收入抽走 ${smuggler.goodsValue} G。`,
        `船上有任何人的護衛，你就被抓，罰款 ${smuggler.fine} G；船沉了又遇到海盜，私貨被搶走。`,
      ],
      '選一艘對手的船夾帶私貨。',
    ),
    step(resolving(5), '看結算', [F.island(BOT.vande), F.island(BOT.tide), F.bar], ['角色揭露時，看看誰的船上有護衛、誰的船上有走私商人。']),

    // ── Round 6: the broker ──
    step(invest(6), '上回合：走私', [F.island(BOT.vande), F.plate('p1')], [
      `${vande}的船沒有護衛：搭它的走私成功。${tide}的船上有${vande}的護衛：搭那艘就被抓了。`,
      `這回合的航海事件是「黑市熱絡」：私貨價值從 ${smuggler.goodsValue} G 提高到 ${R.voyageEvents.blackMarketRushGoodsValue} G。`,
    ]),
    step(invest(6), '上回合：軍火掩護', [F.island(BOT.tide), F.price('arms')], [
      `${vande}派護衛守${tide}的船，想沒收船上的軍火：別人的護衛守在抵達的船上，軍火會全部被沒收。`,
      `但${tide}把自己的走私商人派上自己的船掩護，軍火照常賣出，${vande}只拿到護航費。走私港的玩家不能這樣掩護。`,
    ]),
    step(invest(6), '最後一回合', [F.island('p1'), F.bar], ['這回合要用到留下的木材。'], '裝 1 木材出航（可以再加別的貨，但木材只裝 1）。'),
    step(deploy(6), '莊家', [F.hand, F.market], [
      `莊家押一種貨會漲或會跌，部署費 ${fee('broker')} G。押下去之後，這回合那種貨的需求就往你押的方向調 ${broker.shift}。`,
      `結算時價格真的往你押的方向動，銀行付你 ${broker.payout} G；不動或反向就沒有獎金。`,
    ]),
    step(
      deploy(6),
      '指定一艘船',
      [F.hand, F.market, F.island('p1')],
      [
        '押漲要指定自己的船，押跌要指定對手的船。押對時，那艘船賣這種貨的單價再往押的方向多動 2 格：押漲多賣的錢由銀行補給你，押跌少賣的錢歸你。',
        '這回合木材的需求只有 1，只有你的船載著木材。',
      ],
      `在黑市列押木材會漲，並指定自己的船（部署費 ${fee('broker')} G）。`,
    ),
    step(resolving(6), '看結算', [F.price('wood'), F.island('p1'), F.bar], ['看木材：需求加上你押的 +1 之後，到港量夠不夠。']),
    step({ kind: 'end' }, '押對了', [F.price('wood'), F.plate('p1')], [
      '你押漲讓木材需求從 1 變 2，只到港 1 木材，價格上漲：你拿到獎金，你的船賣木材時再多漲 2 格。',
    ]),
    step({ kind: 'end' }, '總財富', [F.rank], [
      `對局結束時比總財富：現金＋持有建築現金成本的 ${R.buildings.valueRatio * 100}%。倉庫裡剩下的材料不計分。`,
      '教學到這裡結束。想再看某個角色，可以從教學選單的「單課重玩」單獨練習。',
    ]),
  ],
};
