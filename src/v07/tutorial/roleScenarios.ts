import { customsNaming, diplomatGuessing, roleOn } from './allow';
import { BOT, F, R, SEATS, fee, goods, nameOf, shortRules } from './seats';
import type { CoachStep, CoachTrigger, FocusTarget, GuideStep, TutorialScript } from './types';

// The role lessons (docs/tutorial-outline.md §5): each is one round in which your investment is
// played for you and you make one role decision, then see it resolve.

const ROUND1_DEMAND = goods({ wood: 2, iron: 1, spice: 2, arms: 1 });
const vande = nameOf(BOT.vande);
const tide = nameOf(BOT.tide);
const { guard, pirate, smuggler, diplomat } = R.roles;
const anchor = nameOf(BOT.anchor);
const refund = diplomat.refundPercent === 50 ? '一半' : `${diplomat.refundPercent}%`;
const lootPct = (final: number): number => pirate.lootPercentByFinal[final] ?? 0;

const DEPLOY: CoachTrigger = { kind: 'decision', round: 1, phase: 'role-deployment' };
const RESOLVING: CoachTrigger = { kind: 'resolution', round: 1 };
const END: CoachTrigger = { kind: 'end' };

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

/** Said before the first role a lesson asks for. */
const deployIntro = step(DEPLOY, '部署角色', [F.hand], [
  '出航決定好後，大家偷偷派一個角色，也可以不派，沒出航也能派，最後一起翻開。',
  `派角色要付部署費，派過要休息 ${R.roles.cooldown} 回合。`,
]);

/**
 * While the round resolves: what to watch, never the result (the explanation comes at the end).
 * The voyage event card opens the resolution, so it is lit with what moves the show on.
 */
const watch = (focus: readonly FocusTarget[], line: string, trigger: CoachTrigger = RESOLVING): CoachStep => step(trigger, '看結算', [...focus, F.event], [line]);
const voyaged = (owners: readonly string[], round = 1): CoachTrigger => ({ kind: 'voyage', round, owners });
const done = (next: string): CoachStep => step(END, '情境完成', [F.rank], [next]);

const scenario = (script: Omit<TutorialScript, 'rules' | 'seats'>): TutorialScript => ({ ...script, rules: shortRules(1), seats: SEATS });

export const GUARD: TutorialScript = scenario({
  id: 'guard',
  title: '護衛',
  summary: '守住自己的船：骰值 +1。',
  seed: 70201,
  rounds: [
    {
      demand: ROUND1_DEMAND,
      event: 'calm-seas',
      rolls: { p1: 1, [BOT.vande]: 5 },
      bots: { [BOT.vande]: { load: { iron: 1 } } },
      you: {
        invest: { demo: { load: { wood: 1, spice: 1 } }, choose: false },
        'role-deployment': { demo: { role: ['guard', 'p1'] }, choose: true, allow: roleOn('guard', ['p1']) },
      },
    },
  ],
  coach: [
    step(DEPLOY, '你的船已經出航', [F.island('p1')], ['這課你的船已經裝好 1 木材、1 香料出航了。']),
    deployIntro,
    step(
      DEPLOY,
      '護衛',
      [F.hand, F.island('p1')],
      [
        `護衛守自己的船，骰值 +${guard.modifier}。你看不到自己擲幾，但信天翁號只有最終值 1 會沉，加 ${guard.modifier} 就不會沉了。`,
      ],
      `派護衛守自己的船（部署費 ${fee('guard')} G）。`,
      [F.role('guard'), F.target('p1')],
    ),
    watch([], '角色翻開後，看你的船：擲幾、護衛加多少、到沒到。'),
    step(voyaged(['p1']), '差一點就沉了', [F.beat], [
      `你擲到 1，本來會沉；護衛加 ${guard.modifier} 變 2，撐住了。`,
      `碰上「月黑風高」，有護衛的船 ${R.voyageEvents.moonlessNight}，護衛就白派了。`,
    ]),
    done('下一課：海盜。'),
  ],
});

export const PIRATE: TutorialScript = scenario({
  id: 'pirate',
  title: '海盜',
  summary: '攔截對手的船，分走一部分貨值。',
  seed: 70202,
  rounds: [
    {
      demand: ROUND1_DEMAND,
      event: 'calm-seas',
      rolls: { [BOT.vande]: 2, [BOT.tide]: 6 },
      bots: { [BOT.vande]: { load: { wood: 2 } }, [BOT.tide]: { load: { iron: 1 } } },
      you: {
        invest: { demo: {}, choose: false },
        'role-deployment': { demo: { role: ['pirate', BOT.vande] }, choose: true, allow: roleOn('pirate', [BOT.vande]) },
      },
    },
  ],
  coach: [
    step(DEPLOY, '你這回合不出航', [F.island(BOT.vande), F.island(BOT.tide)], [`這課你不出航，只派角色。${vande}和${tide}出航了。`]),
    deployIntro,
    step(
      DEPLOY,
      '海盜',
      [F.hand, F.island(BOT.vande)],
      [
        `海盜讓一艘船 ${pirate.modifier}。船沉了，海盜分走貨值的 ${lootPct(1)}%。`,
        `最終值 2 還會到港，海盜分走船東收入的 ${lootPct(2)}%，3 以上就拿不到。攔到通緝者的船，銀行再多給 ${R.wanted.lootBonus} G。`,
      ],
      `派海盜鎖定${vande}的船（部署費 ${fee('pirate')} G）。`,
      [F.role('pirate'), F.target(BOT.vande)],
    ),
    watch([], `看${vande}的船會不會被海盜的 ${pirate.modifier} 拖下水。`),
    step(voyaged([BOT.vande]), '擊沉', [F.beat], [
      `${vande}擲到 2，海盜 ${pirate.modifier} 變 1，沉了，貨值的 ${lootPct(1)}% 歸你。`,
      `碰上「海霧」，被海盜盯上的船反而 +${R.voyageEvents.seaFog}。`,
    ]),
    done('下一課：海關。'),
  ],
});

export const CUSTOMS: TutorialScript = scenario({
  id: 'customs',
  title: '海關',
  summary: '指名對手船上的一種貨，抵達時優先拿走。',
  seed: 70203,
  rounds: [
    {
      demand: ROUND1_DEMAND,
      event: 'calm-seas',
      rolls: { [BOT.vande]: 6 },
      bots: { [BOT.vande]: { load: { arms: 1, wood: 1 } } },
      you: {
        invest: { demo: {}, choose: false },
        'role-deployment': {
          demo: { role: ['customs', BOT.vande], named: 'arms' },
          choose: true,
          allow: roleOn('customs', [BOT.vande]),
          ready: customsNaming('arms', BOT.vande),
        },
      },
    },
  ],
  coach: [
    step(DEPLOY, '你這回合不出航', [F.island(BOT.vande)], [`這課你不出航。${vande}載著貨出航了。`]),
    deployIntro,
    step(
      DEPLOY,
      '海關',
      [F.hand, F.island(BOT.vande)],
      [
        '海關盯一艘別人的船，指名一種貨。那種貨送到港幾箱，錢就全歸你，船上沒有就白派。',
        `船上的走私商人也會被抓，罰 ${smuggler.fine} G，私貨的錢歸你。`,
      ],
      `派海關鎖定${vande}的船，指名軍火（部署費 ${fee('customs')} G）。`,
      [F.role('customs'), F.target(BOT.vande), F.naming('arms')],
    ),
    watch([], `看${vande}的船：到港後，軍火的錢先歸你。`),
    step(voyaged([BOT.vande]), '沒收', [F.beat], [`${vande}的船到港，軍火的錢歸你，${vande}只賣到木材。`]),
    done('下一課：走私商人。'),
  ],
});

export const SMUGGLER: TutorialScript = scenario({
  id: 'smuggler',
  title: '走私商人',
  summary: '搭別人的船夾帶私貨；遇到海關就會被抓。',
  seed: 70204,
  rounds: [
    {
      demand: ROUND1_DEMAND,
      event: 'black-market-rush',
      rolls: { [BOT.vande]: 5, [BOT.tide]: 5 },
      bots: { [BOT.vande]: { load: { wood: 2 } }, [BOT.tide]: { load: { iron: 1 } }, [BOT.anchor]: { role: ['customs', BOT.tide], named: 'iron' } },
      you: {
        invest: { demo: {}, choose: false },
        'role-deployment': {
          demo: { role: ['smuggler', BOT.vande] },
          choose: true,
          allow: roleOn('smuggler', [BOT.vande, BOT.tide]),
          ready: roleOn('smuggler', [BOT.vande, BOT.tide]),
        },
      },
    },
  ],
  coach: [
    step(DEPLOY, '你這回合不出航', [F.island(BOT.vande), F.island(BOT.tide)], [`這課你不出航。${vande}和${tide}出航了。`]),
    deployIntro,
    step(
      DEPLOY,
      '走私商人',
      [F.hand, F.island(BOT.vande), F.island(BOT.tide)],
      [
        `走私商人搭別人的船夾帶私貨，自己不用出航。船平安到港、船上沒有海關，你就從船東那裡抽 ${smuggler.goodsValue} G。`,
        `船上有海關就被抓，罰 ${smuggler.fine} G。船沉了又有海盜，私貨會被搶。`,
      ],
      '選一艘對手的船夾帶私貨。',
      [F.role('smuggler'), [F.target(BOT.vande), F.target(BOT.tide)]],
    ),
    watch([], '角色翻開時，看你搭的船上有沒有海關。'),
    step(voyaged([BOT.vande, BOT.tide]), '揭曉', [F.beat], [
      `${anchor}的海關上了${tide}的船，搭那艘會被抓，搭${vande}的就成功了。`,
      `這回合「黑市熱絡」，私貨從 ${smuggler.goodsValue} G 漲成 ${R.voyageEvents.blackMarketRushGoodsValue} G。`,
    ]),
    done('下一課：掩護。'),
  ],
});

/** The cover lesson: the market takes no arms this round, so the one crate you carry is over the demand (§7.4). */
const COVER_DEMAND = goods({ wood: 2, iron: 1, spice: 2, arms: 0 });
const MARKET: CoachTrigger = { kind: 'market', round: 1 };

export const COVER: TutorialScript = scenario({
  id: 'cover',
  title: '掩護',
  summary: '走私商人派在自己船上，軍火就不會被查扣。',
  seed: 70206,
  rounds: [
    {
      demand: COVER_DEMAND,
      event: 'calm-seas',
      rolls: { p1: 6 },
      you: {
        invest: { demo: { load: { wood: 1, arms: 1 } }, choose: false },
        'role-deployment': { demo: { role: ['smuggler', 'p1'] }, choose: true, allow: roleOn('smuggler', ['p1']) },
      },
    },
  ],
  coach: [
    step(DEPLOY, '軍火太多了', [F.island('p1'), F.market], [
      '這課你的船裝了 1 木材、1 軍火出航。',
      `軍火這回合「需」是 ${COVER_DEMAND.arms}，你那箱送到就會被查扣。`,
    ]),
    deployIntro,
    step(
      DEPLOY,
      '掩護',
      [F.hand, F.island('p1')],
      [
        '走私商人派在自己船上叫「掩護」：船上的軍火不會被查扣，海關也沒收不了。',
        `掩護不抽錢，部署費 ${fee('smuggler')} G 還是要付。`,
      ],
      '派走私商人上自己的船。',
      [F.role('smuggler'), F.target('p1')],
    ),
    watch([], '黑市成交時，看軍火那一列。'),
    step(MARKET, '掩護成功', [F.marketCard], [
      '軍火超過需求，查緝來了。你有掩護，那箱軍火保住了，等一下賣得到錢。',
      '走私港的軍火不能掩護。',
    ]),
    done('下一課：外交官。'),
  ],
});

export const DIPLOMAT: TutorialScript = scenario({
  id: 'diplomat',
  title: '外交官',
  summary: '猜哪個角色會衝著你的船來；猜中就作廢它並向對手拿錢。',
  seed: 70205,
  rounds: [
    {
      demand: ROUND1_DEMAND,
      event: 'calm-seas',
      rolls: { p1: 5 },
      bots: { [BOT.tide]: { role: ['pirate', 'p1'] } },
      you: {
        invest: { demo: { load: { wood: 1, spice: 1 } }, choose: false },
        'role-deployment': {
          demo: { role: ['diplomat', 'p1'], guess: 'pirate' },
          choose: true,
          allow: roleOn('diplomat', ['p1']),
          ready: diplomatGuessing('pirate', 'p1'),
        },
      },
    },
  ],
  coach: [
    step(DEPLOY, '你的船已經出航', [F.island('p1')], ['這課你的船已經裝好 1 木材、1 香料出航了。']),
    deployIntro,
    step(
      DEPLOY,
      '外交官',
      [F.hand, F.island('p1')],
      [
        '外交官守自己的船，猜哪個角色會被派上來，護衛、海盜、走私商人、海關都能猜。',
        `猜中，那個角色作廢，被作廢的對手每人付你 ${diplomat.take} G。猜錯，退你${refund}部署費。`,
      ],
      `派外交官守自己的船，猜海盜（部署費 ${fee('diplomat')} G）。`,
      [F.role('diplomat'), F.target('p1'), F.naming('pirate')],
    ),
    watch([], '角色翻開時，看有沒有人真的派海盜來。'),
    step(voyaged(['p1']), '猜中了', [F.beat], [`${tide}派海盜盯你的船，被你的外交官作廢了，海盜的 ${pirate.modifier} 沒生效，還付你 ${diplomat.take} G。`]),
    done('角色教學到這裡結束。'),
  ],
});

export const ROLE_SCENARIOS: readonly TutorialScript[] = [GUARD, PIRATE, CUSTOMS, SMUGGLER, COVER, DIPLOMAT];
