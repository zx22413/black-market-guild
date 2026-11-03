import { customsNaming, diplomatGuessing, roleOn } from './allow';
import { BOT, F, R, SEATS, fee, goods, nameOf, shortRules } from './seats';
import type { CoachStep, CoachTrigger, FocusTarget, GuideStep, TutorialScript } from './types';

// The role lessons (docs/tutorial-outline.md §5): each is one round in which your investment is
// played for you and you make one role decision, then see it resolve.

const ROUND1_DEMAND = goods({ wood: 2, iron: 1, spice: 2, arms: 1 });
const vande = nameOf(BOT.vande);
const tide = nameOf(BOT.tide);
const { guard, pirate, smuggler, diplomat } = R.roles;
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
  '投資之後，所有人同時、秘密選一個角色派出去，也可以不派；不出航也能派。角色在大家都決定後一次揭露。',
  `每個角色有部署費，用過之後要冷卻 ${R.roles.cooldown} 回合才能再派。`,
  '手牌上方的「你的船上」會列出你這回合裝了什麼貨，選角色之前可以先看一眼。',
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
    step(DEPLOY, '你的船已經出航', [F.island('p1')], ['這一課你的投資已經先做好了：你的船裝著 1 木材、1 香料出航。']),
    deployIntro,
    step(
      DEPLOY,
      '護衛',
      [F.hand, F.island('p1')],
      [
        `護衛只能守自己的船，讓它的航行骰 +${guard.modifier}。你看不到自己的骰值，派護衛是押注：只有最終值 1 會沉，加成讓沉船的機會從六分之一降到零，也讓抵達後的收入比例往上跳一級。`,
      ],
      `派護衛守自己的船（部署費 ${fee('guard')} G）。`,
      [F.role('guard'), F.target('p1')],
    ),
    watch([], '角色一次全部揭露，接著看你的船：起始骰值、護衛的加成，再判定抵達或沉沒。'),
    step(voyaged(['p1']), '差一點就沉了', [F.beat], [
      `你的船原始骰值只有 1，會沉；護衛 +${guard.modifier} 後變 2，剛好抵達。`,
      '小心航海事件「月黑風高」：被護衛守著的船 −1，正好抵銷護衛。',
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
    step(DEPLOY, '你這回合不出航', [F.island(BOT.vande), F.island(BOT.tide)], [`這一課你留在港裡，只派角色。${vande}和${tide}出航了。`]),
    deployIntro,
    step(
      DEPLOY,
      '海盜',
      [F.hand, F.island(BOT.vande)],
      [
        `海盜鎖定一艘船，讓它 ${pirate.modifier}。最終值 1 的船沉沒，海盜平分貨值的 ${lootPct(1)}%；最終值 2 的船勉強抵達，海盜從船東的收入裡平分 ${lootPct(2)}%。`,
        `最終值 3 以上海盜什麼都拿不到。船上載著通緝者的貨時，海盜再多拿 ${R.wanted.lootBonus} G（銀行付）。`,
      ],
      `派海盜鎖定${vande}的船（部署費 ${fee('pirate')} G）。`,
      [F.role('pirate'), F.target(BOT.vande)],
    ),
    watch([], `看${vande}的船：海盜的 ${pirate.modifier} 會不會讓它沉下去。`),
    step(voyaged([BOT.vande]), '擊沉', [F.beat], [
      `${vande}的船原始骰值 2，海盜 ${pirate.modifier} 後變 1，沉沒，貨值的 ${lootPct(1)}% 歸你。`,
      '小心航海事件「海霧」：被海盜鎖定的船 +1，海盜反而幫了對手。',
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
    step(DEPLOY, '你這回合不出航', [F.island(BOT.vande)], [`這一課你留在港裡。${vande}載著貨出航了。`]),
    deployIntro,
    step(
      DEPLOY,
      '海關',
      [F.hand, F.island(BOT.vande)],
      [
        `海關只能鎖定別人的船，並指名其中一種貨，部署費 ${fee('customs')} G。船抵達時，海關優先拿走指名那種貨縮放後的整塊價值，指名的貨沒上船就什麼都拿不到。`,
        `海關也會抓走私商人：罰款 ${smuggler.fine} G，私貨的價值歸海關。你可以從公開的倉庫猜他載了什麼。`,
      ],
      `派海關鎖定${vande}的船，指名軍火（部署費 ${fee('customs')} G）。`,
      [F.role('customs'), F.target(BOT.vande), F.naming('arms')],
    ),
    watch([], `看${vande}的船：抵達後，軍火的價值先歸海關。`),
    step(voyaged([BOT.vande]), '沒收', [F.beat], [`${vande}的船抵達，軍火被你指名沒收；船東只拿到木材的收入。`]),
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
    step(DEPLOY, '你這回合不出航', [F.island(BOT.vande), F.island(BOT.tide)], [`這一課你留在港裡。${vande}和${tide}出航了。`]),
    deployIntro,
    step(
      DEPLOY,
      '走私商人',
      [F.hand, F.island(BOT.vande), F.island(BOT.tide)],
      [
        `走私商人搭別人的船夾帶私貨，不必自己出航，部署費 ${fee('smuggler')} G。船抵達、船上沒有海關時，你從船東的賣貨收入抽走 ${smuggler.goodsValue} G。`,
        `船上有任何人的海關，你就被抓，罰款 ${smuggler.fine} G；船沉了又遇到海盜，私貨被搶走。`,
      ],
      '選一艘對手的船夾帶私貨。',
      [F.role('smuggler'), [F.target(BOT.vande), F.target(BOT.tide)]],
    ),
    watch([], '角色揭露時，看看你搭的那艘船上有沒有海關。'),
    step(voyaged([BOT.vande, BOT.tide]), '揭曉', [F.beat], [
      `金錨公會派了海關上${tide}的船：選那艘就被抓了。${vande}的船沒有海關，走私成功。`,
      `這回合的航海事件是「黑市熱絡」：私貨價值從 ${smuggler.goodsValue} G 提高到 ${R.voyageEvents.blackMarketRushGoodsValue} G。`,
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
    step(DEPLOY, '你的船已經出航', [F.island('p1')], ['這一課你的船裝著 1 木材、1 香料出航。']),
    deployIntro,
    step(
      DEPLOY,
      '外交官',
      [F.hand, F.island('p1')],
      [
        `外交官只能守自己的船，部署費 ${fee('diplomat')} G。你要猜一個角色：護衛、海盜、走私商人或海關，會不會被派來針對你的船。`,
        `猜中：那個角色在你船上的部署全部作廢（部署費不退），你向每位被作廢的對手拿 ${diplomat.take} G。猜錯：退你一半部署費。`,
      ],
      `派外交官守自己的船，猜海盜（部署費 ${fee('diplomat')} G）。`,
      [F.role('diplomat'), F.target('p1'), F.naming('pirate')],
    ),
    watch([], '角色揭露時，看看有沒有人真的派海盜來。'),
    step(voyaged(['p1']), '猜中了', [F.beat], [`${tide}派海盜鎖定你的船，被你的外交官作廢：海盜的 ${pirate.modifier} 沒有生效，你還向他拿了 ${diplomat.take} G。`]),
    done('角色教學到這裡結束。'),
  ],
});

export const ROLE_SCENARIOS: readonly TutorialScript[] = [GUARD, PIRATE, CUSTOMS, SMUGGLER, DIPLOMAT];
