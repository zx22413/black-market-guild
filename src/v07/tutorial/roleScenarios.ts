import { betOn, roleOn, rerollOrKeep } from './allow';
import { BOT, F, R, SEATS, fee, goods, nameOf, shortRules } from './seats';
import type { CoachStep, CoachTrigger, FocusTarget, GuideStep, TutorialScript } from './types';

// The role lessons (docs/tutorial-outline.md §5): each is one round in which your investment is
// played for you and you make one role decision, then see it resolve.

const ROUND1_DEMAND = goods({ wood: 2, iron: 1, spice: 2, arms: 1 });
const vande = nameOf(BOT.vande);
const tide = nameOf(BOT.tide);
const { guard, pirate, smuggler, broker } = R.roles;

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
  summary: '守住一艘船：骰值 +1，抵達時還能領護航費。',
  seed: 70201,
  rounds: [
    {
      demand: ROUND1_DEMAND,
      event: 'calm-seas',
      rolls: { p1: 2, [BOT.vande]: 5 },
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
        `護衛守一艘船，讓它的航行骰 +${guard.modifier}。你看不到自己的骰值，派護衛是押注：抵達的機會從三分之二提高到六分之五。`,
        `守別人的船、而那艘船抵達時，還能從銀行拿 ${guard.escortFee} G 護航費。`,
      ],
      `派護衛守自己的船（部署費 ${fee('guard')} G）。`,
      [F.role('guard'), F.target('p1')],
    ),
    watch([], '角色一次全部揭露，接著看你的船：起始骰值、護衛的加成，再判定抵達或沉沒。'),
    step(voyaged(['p1']), '差一點就沉了', [F.beat], [
      `你的船原始骰值只有 2，護衛 +${guard.modifier} 後變 3，剛好抵達。`,
      '小心航海事件「月黑風高」：被護衛守著的船 −1，正好抵銷護衛。',
    ]),
    done('下一課：海盜。'),
  ],
});

export const PIRATE: TutorialScript = scenario({
  id: 'pirate',
  title: '海盜',
  summary: '擊沉對手的船，分走戰利品。',
  seed: 70202,
  rounds: [
    {
      demand: ROUND1_DEMAND,
      event: 'calm-seas',
      rolls: { [BOT.vande]: 3, [BOT.tide]: 6 },
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
        `海盜鎖定一艘船，讓它 ${pirate.modifier}。那艘船沉沒時，銀行付戰利品，由鎖定它的海盜平分：最終值 2 付 ${pirate.loot[2]} G，最終值 1 付 ${pirate.loot[1]} G。`,
        `船上載著通緝者的貨時，戰利品再多 ${R.wanted.lootBonus} G。`,
      ],
      `派海盜鎖定${vande}的船（部署費 ${fee('pirate')} G）。`,
      [F.role('pirate'), F.target(BOT.vande)],
    ),
    watch([], `看${vande}的船：海盜的 ${pirate.modifier} 會不會讓它沉下去。`),
    step(voyaged([BOT.vande]), '擊沉', [F.beat], [
      `${vande}的船原始骰值 3，海盜 ${pirate.modifier} 後變 2，沉沒，戰利品歸你。`,
      '小心航海事件「海霧」：被海盜鎖定的船 +1，海盜反而幫了對手。',
    ]),
    done('下一課：情報商人。'),
  ],
});

export const INTEL: TutorialScript = scenario({
  id: 'intel',
  title: '情報商人',
  summary: '唯一看得到骰值的角色：看完再決定要不要重擲。',
  seed: 70203,
  rounds: [
    {
      demand: ROUND1_DEMAND,
      event: 'calm-seas',
      rolls: { p1: 2, [BOT.vande]: 5 },
      rerolls: { p1: 5 },
      bots: { [BOT.vande]: { load: { iron: 1 } } },
      you: {
        invest: { demo: { load: { wood: 1, spice: 1 } }, choose: false },
        'role-deployment': { demo: { role: ['intel', 'p1'] }, choose: true, allow: roleOn('intel', ['p1']) },
        'intel-reroll': { demo: { reroll: 'p1' }, choose: true, allow: rerollOrKeep },
      },
    },
  ],
  coach: [
    step(DEPLOY, '你的船已經出航', [F.island('p1')], ['這一課你的船裝著 1 木材、1 香料出航。']),
    deployIntro,
    step(
      DEPLOY,
      '情報商人',
      [F.hand, F.island('p1')],
      ['情報商人鎖定一艘船，看它的原始骰值，再決定要不要重擲；重擲就必須接受新結果。', '做決定時，你還不知道航海事件，也不知道別人派了什麼角色。'],
      `派情報商人看自己的船（部署費 ${fee('intel')} G）。`,
      [F.role('intel'), F.target('p1')],
    ),
    step(
      { kind: 'decision', round: 1, phase: 'intel-reroll' },
      '只有你看得到',
      [F.reroll],
      ['你的船原始骰值是 2，照這樣會沉。要不要重擲，由你決定。'],
      '選擇重擲，或維持原本的骰值。',
    ),
    watch([], '角色揭露時，大家都看得到哪艘船被重擲，但原本的骰值永遠只有你知道。'),
    step(voyaged(['p1']), '重擲的結果', [F.beat], ['重擲的話新骰值是 5，船抵達；維持 2 的話就沉了。']),
    done('下一課：走私商人。'),
  ],
});

export const SMUGGLER: TutorialScript = scenario({
  id: 'smuggler',
  title: '走私商人',
  summary: '搭別人的船夾帶私貨；遇到護衛就會被抓。',
  seed: 70204,
  rounds: [
    {
      demand: ROUND1_DEMAND,
      event: 'black-market-rush',
      rolls: { [BOT.vande]: 5, [BOT.tide]: 5 },
      bots: { [BOT.vande]: { load: { wood: 2 } }, [BOT.tide]: { load: { iron: 1 }, role: ['guard', BOT.tide] } },
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
        `走私商人搭別人的船夾帶私貨，不必自己出航，部署費 ${fee('smuggler')} G。船抵達、船上沒有護衛時，你從船東的賣貨收入抽走 ${smuggler.goodsValue} G。`,
        `船上有任何人的護衛，你就被抓，罰款 ${smuggler.fine} G；船沉了又遇到海盜，私貨被搶走。`,
      ],
      '選一艘對手的船夾帶私貨。',
      [F.role('smuggler'), [F.target(BOT.vande), F.target(BOT.tide)]],
    ),
    watch([], '角色揭露時，看看你搭的那艘船上有沒有護衛。'),
    step(voyaged([BOT.vande, BOT.tide]), '揭曉', [F.beat], [
      `${tide}派了護衛守自己的船：選那艘就被抓了。${vande}的船沒有護衛，走私成功。`,
      `這回合的航海事件是「黑市熱絡」：私貨價值從 ${smuggler.goodsValue} G 提高到 ${R.voyageEvents.blackMarketRushGoodsValue} G。`,
    ]),
    done('下一課：軍火掩護。'),
  ],
});

export const ARMS_COVER: TutorialScript = scenario({
  id: 'arms-cover',
  title: '軍火掩護',
  summary: '軍火會被別人的護衛沒收；派自己的走私商人上船掩護。',
  seed: 70205,
  rounds: [
    {
      demand: ROUND1_DEMAND,
      event: 'calm-seas',
      rolls: { p1: 5 },
      bots: { [BOT.vande]: { role: ['guard', 'p1'] } },
      you: {
        invest: { demo: { load: { wood: 1, arms: 1 } }, choose: false },
        'role-deployment': { demo: { role: ['smuggler', 'p1'] }, choose: true, allow: roleOn('smuggler', ['p1'], true), ready: roleOn('smuggler', ['p1']) },
      },
    },
  ],
  coach: [
    step(DEPLOY, '你的船載著軍火', [F.island('p1')], ['這一課你的船裝著 1 木材、1 軍火出航。']),
    step(DEPLOY, '軍火會被沒收', [F.price('arms'), F.island('p1')], [
      '軍火賣得貴，但船抵達時，只要有別人的護衛守在船上，船上的軍火全部被沒收，價值歸那些護衛。',
      '你不知道有沒有人派護衛來守你的船。',
    ]),
    step(
      DEPLOY,
      '掩護',
      [F.hand, F.island('p1')],
      ['把自己的走私商人派上自己載著軍火的船，軍火就不會被沒收。他不賺錢，被護衛撞見也不罰款。', '走私港的玩家不能這樣做：他的軍火不能被掩護。'],
      '派走私商人上自己的船掩護軍火，或不派，看看會怎樣。',
      [F.role('smuggler'), F.target('p1')],
    ),
    watch([], '角色揭露時，看看有沒有人派護衛守你的船。'),
    step(voyaged(['p1']), '揭曉', [F.beat], [
      `${vande}派了護衛守你的船，想沒收你的軍火。有掩護的話軍火照常賣出；沒掩護就被他拿走了。`,
      `他守的是別人的船、船又抵達，沒收不到軍火時，就改拿 ${guard.escortFee} G 護航費。`,
    ]),
    done('下一課：莊家。'),
  ],
});

/** Wood: the broker's bull bet raises its demand, so the one crate that arrives is below it. */
const BROKER_DEMAND = goods({ wood: 1, iron: 1, spice: 2, arms: 1 });
/** Round 2, iron: the bear bet takes its demand from 1 to 0, so the one crate that arrives is above it. */
const BROKER_BEAR_DEMAND = goods({ wood: 2, iron: 1, spice: 2, arms: 1 });

const DEPLOY2: CoachTrigger = { kind: 'decision', round: 2, phase: 'role-deployment' };
const RESOLVING2: CoachTrigger = { kind: 'resolution', round: 2 };
const MARKET1: CoachTrigger = { kind: 'market', round: 1 };

export const BROKER: TutorialScript = {
  ...scenario({
    id: 'broker',
    title: '莊家',
    summary: '押一種貨的漲或跌；押對了拿獎金，指定的船還能多賣或少賣。',
    seed: 70206,
    rounds: [
      {
        demand: BROKER_DEMAND,
        event: 'calm-seas',
        rolls: { p1: 5, [BOT.vande]: 5 },
        bots: { [BOT.vande]: { load: { iron: 1 } } },
        you: {
          invest: { demo: { load: { wood: 1, spice: 1 } }, choose: false },
          'role-deployment': {
            demo: { bet: { good: 'wood', direction: 1, aim: 'p1' } },
            choose: true,
            allow: betOn({ good: 'wood', direction: 1 }, 'p1'),
          },
        },
      },
      {
        demand: BROKER_BEAR_DEMAND,
        event: 'calm-seas',
        rolls: { p1: 5, [BOT.vande]: 5 },
        bots: { [BOT.vande]: { load: { iron: 1 } } },
        you: {
          invest: { demo: { load: { wood: 1 } }, choose: false },
          'role-deployment': {
            demo: { bet: { good: 'iron', direction: -1, aim: BOT.vande } },
            choose: true,
            allow: betOn({ good: 'iron', direction: -1 }, BOT.vande),
          },
        },
      },
    ],
    coach: [
      step(DEPLOY, '你的船已經出航', [F.island('p1')], ['這一課你的船裝著 1 木材、1 香料出航。']),
      step(DEPLOY, '部署角色', [F.hand], [
        '投資之後，所有人同時、秘密選一個角色派出去，也可以不派。角色在大家都決定後一次揭露。',
        `每個角色有部署費，用過之後要冷卻 ${R.roles.cooldown} 回合才能再派；這一課為了讓你連續練兩種押法，莊家不用冷卻。`,
      ]),
      step(DEPLOY, '莊家', [F.hand], [
        `莊家押一種貨會漲或會跌，部署費 ${fee('broker')} G。押下去之後，這回合那種貨的需求就往你押的方向調 ${broker.shift}。`,
        `結算時價格真的往你押的方向動，銀行付你 ${broker.payout} G；不動或反向就沒有獎金。`,
      ]),
      step(
        DEPLOY,
        '押漲：指定自己的船',
        [F.hand, F.island('p1')],
        [
          '押漲要指定自己的船。押對時，那艘船賣這種貨的單價再往上多動 2 格，多賣的錢由銀行補給你。',
          '這回合木材的需求只有 1，你的船上有 1 木材。',
        ],
        `選莊家，點自己的船，再在船旁的清單押木材會漲（部署費 ${fee('broker')} G）。`,
        [F.role('broker'), F.target('p1'), F.bet('wood', 1)],
      ),
      watch([F.price('wood')], '看木材：需求加上你押的 +1 之後，到港量夠不夠。'),
      step(MARKET1, '押對了', [F.marketCard], [
        '你押漲讓木材需求從 1 變 2，只到港 1 木材，價格上漲：你拿到獎金。',
        '你的船賣木材時再多漲 2 格，多賣的錢由銀行補給你。',
      ]),
      step(DEPLOY2, '押跌：指定對手的船', [F.hand, F.island(BOT.vande)], [
        `押跌要指定對手出航的船。這回合 ${vande}的船載著 1 鐵礦，鐵礦的需求也只有 1。`,
        '押跌讓需求從 1 變 0；他的鐵礦到港就比需求多，價格會跌。',
      ],
      `選莊家，點${vande}的船，再在船旁的清單押鐵礦會跌（莊家這課不用冷卻）。`,
      [F.role('broker'), F.target(BOT.vande), F.bet('iron', -1)]),
      watch([F.price('iron')], '看鐵礦：需求減掉你押的 1 之後，到港的 1 鐵礦夠不夠賣。', RESOLVING2),
      step({ kind: 'market', round: 2 }, '押跌也賺錢', [F.marketCard], [
        '押跌讓鐵礦需求變 0，到港 1 鐵礦比需求多，價格下跌：銀行付你獎金。',
        `押跌時，${vande}的船賣鐵礦的單價再往下多動 2 格，少賣的差額由你拿走（最多拿到他的賣貨收入）。`,
      ]),
      done('角色教學到這裡結束。'),
    ],
  }),
  rules: { ...shortRules(2), roles: { ...R.roles, cooldown: 0 } },
};

export const ROLE_SCENARIOS: readonly TutorialScript[] = [GUARD, PIRATE, INTEL, SMUGGLER, ARMS_COVER, BROKER];
