/**
 * Runs many bot-only matches under the official V0.8 rules and prints a Markdown balance report.
 * Usage: npm run simulate -- [--matches 1000] [--players 4] [--seed 1]
 *        [--lineup balanced,cautious,aggressive,builder]
 *        [--set roles.pirate.loot=150 ...] [--summary] [--v07] [--buildings]
 * `--set` overrides any numeric rule (repeatable) to test balance ideas without editing
 * the rules; `--summary` prints one Markdown table row of key metrics instead of a report.
 * `--v07` plays the V0.7.1 ship bays (RULES_V07) and `--buildings` the old rules with the four buildings
 * (RULES_BUILDINGS), for comparison. `--v08` is still accepted (the default since 2026-11-23). The V0.8 numbers are
 * under `v08.` for `--set` (e.g. `--set v08.raise.multiplier=350`).
 * Seats rotate every match so each strategy plays every seat position.
 */
import { BOT_STRATEGIES, type BotStrategy } from '../src/v07/bots';
import { BUILDING_IDS, GOODS, ROLE_IDS, RULES_BUILDINGS, RULES_V07, RULES_V08, SHIP_TYPE_IDS, priceAt, v08On, type Rules } from '../src/v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../src/v07/match';
import { addMatch, emptyStats, type SimStats } from './sim-stats';

interface Options {
  readonly matches: number;
  readonly players: number;
  readonly seed: number;
  readonly lineup: readonly BotStrategy[];
  readonly overrides: readonly string[];
  readonly rules: Rules;
  readonly summary: boolean;
  /** Print the betting groups (always on when a tide shield switch is on). */
  readonly bets: boolean;
}

/** Returns a copy of the rules with `path=value` numeric overrides applied. */
function applyOverrides(base: Rules, overrides: readonly string[]): Rules {
  const rules = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  for (const entry of overrides) {
    const [path, raw] = entry.split('=');
    const value = Number(raw);
    const keys = (path ?? '').split('.');
    const parent = keys.slice(0, -1).reduce<Record<string, unknown> | undefined>(
      (node, key) => node?.[key] as Record<string, unknown> | undefined,
      rules,
    );
    const leaf = keys.at(-1)!;
    if (parent === undefined || typeof parent[leaf] !== 'number' || Number.isNaN(value)) {
      throw new Error(`invalid override "${entry}": expected an existing numeric rule path=number`);
    }
    parent[leaf] = value;
  }
  return rules as unknown as Rules;
}

function parseOptions(): Options {
  const argv = (globalThis as { process?: { argv?: string[] } }).process?.argv?.slice(2) ?? [];
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const overrides = argv.flatMap((arg, i) => (arg === '--set' && argv[i + 1] ? [argv[i + 1]!] : []));
  const lineup = (get('lineup') ?? 'balanced,cautious,aggressive,builder').split(',') as BotStrategy[];
  const unknown = lineup.filter((s) => !(BOT_STRATEGIES as readonly string[]).includes(s));
  if (unknown.length > 0) {
    throw new Error(`unknown strategies: ${unknown.join(', ')}; choose from ${BOT_STRATEGIES.join(', ')}`);
  }
  const options = {
    matches: Number.parseInt(get('matches') ?? '1000', 10),
    players: Number.parseInt(get('players') ?? '4', 10),
    seed: Number.parseInt(get('seed') ?? '1', 10),
    lineup,
    overrides,
    rules: applyOverrides(argv.includes('--v07') ? RULES_V07 : argv.includes('--buildings') ? RULES_BUILDINGS : RULES_V08, overrides),
    summary: argv.includes('--summary'),
    bets: false,
  };
  if (![options.matches, options.players, options.seed].every(Number.isInteger)) {
    throw new Error('--matches, --players and --seed must be integers');
  }
  return { ...options, bets: argv.includes('--bets') || shieldsOn(options.rules) };
}

function seatsFor(options: Options, index: number): SeatConfig[] {
  return Array.from({ length: options.players }, (_, k) => {
    const strategy = options.lineup[(index + k) % options.lineup.length]!;
    return { kind: 'bot', name: `${strategy}#${k + 1}`, strategy };
  });
}

function run(options: Options): SimStats {
  const stats = emptyStats(options.rules.price.steps);
  for (let i = 0; i < options.matches; i += 1) {
    const seats = seatsFor(options, i);
    const setup = setupFromSeats({ seed: options.seed + i, seats, rules: options.rules });
    const log = runMatchSync(setup, setup.bots);
    addMatch(stats, log, (id) => (seats[Number(id.slice(1)) - 1] as { strategy: string }).strategy);
  }
  return stats;
}

// ── Formatting ────────────────────────────────────────────────────────────────

const pct = (part: number, whole: number) => (whole === 0 ? '—' : `${((100 * part) / whole).toFixed(1)}%`);
const per = (part: number, whole: number) => (whole === 0 ? '—' : (part / whole).toFixed(2));

function table(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string[] {
  return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)];
}

const BUILDING_LABELS: Record<string, string> = { shipyard: '造船廠', insurance: '航運保險', salvage: '打撈公司', exchange: '貿易交易所' };
const ROLE_LABELS: Record<string, string> = { customs: '海關', guard: '護衛', pirate: '海盜', smuggler: '走私商人', diplomat: '外交官' };
const GOOD_LABELS: Record<string, string> = { wood: '木材', iron: '鐵礦', spice: '香料', arms: '軍火' };
const ISLAND_LABELS: Record<string, string> = {
  'spice-isles': '香料群島',
  'pirate-cove': '海盜灣',
  lumber: '船塢島',
  mine: '礦山島',
  'smuggler-port': '走私港',
  'free-port': '自由港',
  fortress: '要塞島',
  lighthouse: '燈塔島',
};

function pirateNet(s: SimStats): number {
  return (s.pirateIncome - s.pirateFees) / Math.max(1, s.roles.pirate ?? 0);
}

function deployments(s: SimStats): number {
  return Object.values(s.roles).reduce((a, b) => a + b, 0);
}

function winSection(options: Options, s: SimStats): string[] {
  const tallyRow = (label: string, e: { seats: number; wins: number; wealth: number }) => [label, e.seats, pct(e.wins, e.seats), per(e.wealth, e.seats)];
  return [
    '## 1. 勝率與財富',
    '',
    ...table(
      ['策略', '座位數', '勝率', '平均財富'],
      [...new Set(options.lineup)].map((st) => tallyRow(st, s.byStrategy[st] ?? { seats: 0, wins: 0, wealth: 0 })),
    ),
    '',
    `- 每局最高與最低財富差距平均 ${per(s.wealthSpread, s.matches)} G。`,
    '',
    `島嶼（公平勝率 ${(100 / options.players).toFixed(1)}%）：`,
    '',
    ...table(
      ['島', '座位數', '勝率', '平均財富'],
      Object.entries(s.byIsland)
        .sort(([, a], [, b]) => b.wins / b.seats - a.wins / a.seats)
        .map(([island, e]) => tallyRow(ISLAND_LABELS[island] ?? island, e)),
    ),
  ];
}

function marketSection(options: Options, s: SimStats): string[] {
  const { rules } = options;
  const goodRounds = s.rounds * GOODS.length;
  return [
    '## 3. 出航與市場',
    '',
    `- 出航的玩家回合：${pct(s.ships, s.playerRounds)}；抵達率 ${pct(s.shipsArrived, s.ships)}；每艘平均 ${per(s.unitsShipped, s.ships)} 單位（軍火 ${per(
      s.armsShipped,
      s.ships,
    )}）；平均每回合裝運 ${per(s.unitsShipped, s.rounds)} 單位。`,
    `- 到港量對需求（每種商品每回合）：少於需求 ${pct(s.demandVsArrived.under, goodRounds)}、剛好 ${pct(s.demandVsArrived.exact, goodRounds)}、多於需求 ${pct(
      s.demandVsArrived.over,
      goodRounds,
    )}。`,
    `- 終局每名玩家平均剩下 ${per(s.unsoldUnits, s.seats)} 單位材料（不計分）：${GOODS.map((g) => `${GOOD_LABELS[g]} ${per(s.unsoldByGood[g] ?? 0, s.seats)}`).join('、')}。`,
    '',
    '回合結束時的價格分布（每種商品的價格軌不同，格內是該格的價格）：',
    '',
    ...table(
      ['商品', ...Array.from({ length: rules.price.steps }, (_, k) => `第 ${k} 格`)],
      GOODS.map((g) => {
        const counts = s.priceSteps[g]!;
        const total = counts.reduce((a, b) => a + b, 0);
        return [GOOD_LABELS[g]!, ...counts.map((c, k) => `${pct(c, total)}（${priceAt(rules, g, k)} G）`)];
      }),
    ),
  ];
}

/** Experiment (rules.ships): how often each ship type sailed, sank, and the average sale income it paid its owner. */
function shipTypeLines(s: SimStats): string[] {
  const types = Object.entries(s.shipTypes);
  if (types.length <= 1) return [];
  return [
    '- 船型（實驗）：' +
      types.map(([type, e]) => `${type} ${e.count} 艘（沉沒 ${pct(e.sank, e.count)}、平均每單位貨賣得 ${(e.sales / Math.max(1, e.units)).toFixed(0)} G、每艘裝 ${(e.units / Math.max(1, e.count)).toFixed(1)} 單位）`).join('；'),
  ];
}

function roleSection(s: SimStats): string[] {
  return [
    '## 4. 角色',
    '',
    ...table(
      ['角色', '部署次數', '佔所有玩家回合'],
      [...ROLE_IDS.map((r) => [ROLE_LABELS[r]!, s.roles[r] ?? 0, pct(s.roles[r] ?? 0, s.playerRounds)]), ['不部署', s.playerRounds - deployments(s), pct(s.playerRounds - deployments(s), s.playerRounds)]],
    ),
    '',
    `- 走私商人：掩護自己的船 ${s.smugglerCovers} 次、上別人船走私 ${(s.roles.smuggler ?? 0) - s.smugglerCovers} 次（被抓 ${s.smugglersCaught} 人次，抽走 ${s.smuggled} G）。`,
    `- 海關：部署 ${s.roles.customs ?? 0} 次；沒收 ${s.armsConfiscatedUnits} 單位、${s.armsConfiscatedCash} G。`,
    `- 海盜：目標沉沒率 ${pct(s.pirateSinks, s.roles.pirate ?? 0)}；每次平均淨收益 ${pirateNet(s).toFixed(0)} G。`,
    `- 外交官：部署 ${s.roles.diplomat ?? 0} 次，向對手拿走 ${s.diplomatTake} G。`,
    ...shipTypeLines(s),
    `- 保險理賠 ${s.insurancePaid} G；打撈 ${s.salvaged} 單位；交易所佣金 ${s.commission} G。`,
  ];
}

const SHIP_LABELS: Record<string, string> = { standard: '信天翁號', gambler: '孤注號', freighter: '巨鯨號', hidden: '幽靈號', breaker: '海嘯號' };
const EFFECT_LABELS: Record<string, string> = {
  reroll: '好兆頭重擲',
  'reroll-saved': '重擲後免於沉沒',
  'extra-die': '巨浪加骰（貨箱欄＝加骰點數）',
  'raise-won': '加注成功（G＝比不加注多賺）',
  'raise-lost': '加注沉沒（G＝不加注本來能賺）',
  salvage: '拾荒（賣出撈到的貨）',
  'private-sold': '私貨艙賣出',
  repairyard: '修船廠少丟的箱',
  armory: '軍械庫（G＝海盜少拿）',
  'armory-armed': '武裝商船出航（載軍火 +1）',
  'armory-counter': '軍械庫反擊（貨箱＝用掉的軍火，G＝收到的賠償）',
  tradehouse: '商行保價多賺',
  'tradehouse-premium': '老字號多賺（高一格）',
  'tradehouse-buyout': '商行收購剩貨（G＝收購金額）',
  'pirate-toll': '要塞島軍械庫收海盜部署費',
  'customs-halved': '走私港軍械庫保住的海關半數',
  inspected: '軍火超量查緝（G＝船東損失）',
  'level-up': '技能練到二級（出航 2 次後）',
  'storm-tide': '風暴潮多丟的箱（G＝船東少賺）',
  'pirate-tide': '海盜潮搶抵港船（G＝海盜拿走）',
  'storm-shield': '修船廠擋下風暴潮（貨箱＝少丟的箱，G＝多賺）',
  'pirate-shield': '軍械庫擋下海盜潮（G＝海盜少拿）',
  'crash-shield': '商行擋下崩盤潮（貨箱＝受保的箱，G＝多賺）',
};
const VOYAGE_EVENT_LABELS: Record<string, string> = {
  tailwind: '順風',
  storm: '暴風雨',
  'sea-fog': '海霧',
  'moonless-night': '月黑風高',
  'black-market-rush': '黑市熱絡',
  'calm-seas': '風平浪靜',
};
const BOSS_LABELS: Record<string, string> = {
  tailwind: '強順風（+2）',
  storm: '大暴風雨（−2）',
  'sea-fog': '海盜伏擊（海盜 −2）',
  'moonless-night': '月黑風高（護衛、自家走私掩護失效）',
  'black-market-rush': '嚴查（查緝額度 −1）',
  'calm-seas': '貨滿為患（跌價加倍）',
};
/** v08.events.bossDemandShift: 貨滿為患 lowers demand instead of doubling drops (2026-11-28). */
const bossLabel = (rules: Rules, event: string): string =>
  event === 'calm-seas' && rules.v08.events.bossDemandShift !== 0 ? `貨滿為患（需求 ${signed(rules.v08.events.bossDemandShift)}）` : BOSS_LABELS[event]!;
const FINAL_LABELS: Record<string, string> = { 'open-market': '黑市大開', 'last-gamble': '最後一搏', 'final-market': '最後的大市集（兩者皆有）', none: '（回合上限／牌庫用完）' };
const TIDE_LABELS: Record<string, string> = { storm: '風暴潮（每船 −1）', pirate: '海盜潮（每海盜 −1）', inspection: '查緝潮（查緝額度 −1）', crash: '崩盤潮（跌價 ×2）' };
const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
/** The tide labels for these rules (the fixed labels above when the storm and pirate tides keep their modifier-only settings). */
function tideLabels(rules: Rules): Record<string, string> {
  const e = rules.v08.events;
  if (e.tideStormExtraLoss <= 0 && e.tidePirateArrivalLoot <= 0) return TIDE_LABELS;
  const join = (parts: readonly string[]) => parts.join('，') || '無效果';
  const storm = [...(e.tideStorm === 0 ? [] : [`每船 ${signed(e.tideStorm)}`]), ...(e.tideStormExtraLoss > 0 ? [`終值 ${e.tideStormLossFrom}–${e.tideStormLossTo} 多丟 ${e.tideStormExtraLoss} 箱`] : [])];
  const pirate = [...(e.tidePirate === 0 ? [] : [`每海盜 ${signed(e.tidePirate)}`]), ...(e.tidePirateArrivalLoot > 0 ? [`抵港船被搶 ${e.tidePirateArrivalLoot}%`] : [])];
  return { ...TIDE_LABELS, storm: `風暴潮（${join(storm)}）`, pirate: `海盜潮（${join(pirate)}）` };
}
/** The trigger columns: the tide-loss and shield effects only when those settings are on. */
function triggerEffects(rules: Rules): readonly string[] {
  const e = rules.v08.events;
  const shields = [
    ...(rules.v08.repairyard.immuneStormTide === 1 ? ['storm-shield'] : []),
    ...(rules.v08.armory.immunePirateTide === 1 ? ['pirate-shield'] : []),
    ...(rules.v08.tradehouse.immuneCrashTide === 1 ? ['crash-shield'] : []),
  ];
  return [...TRIGGER_EFFECTS, ...(e.tideStormExtraLoss > 0 ? ['storm-tide'] : []), ...(e.tidePirateArrivalLoot > 0 ? ['pirate-tide'] : []), ...shields];
}

/** Any building's tide shield (v08.repairyard.immuneStormTide, armory.immunePirateTide, tradehouse.immuneCrashTide). */
function shieldsOn(rules: Rules): boolean {
  return rules.v08.repairyard.immuneStormTide === 1 || rules.v08.armory.immunePirateTide === 1 || rules.v08.tradehouse.immuneCrashTide === 1;
}

const BET_GROUPS = [
  ['right', '揭曉前就有，暗潮對上（押對）'],
  ['wrong', '揭曉前就有，暗潮沒對上（押錯）'],
  ['afterMatch', '揭曉後才拿，暗潮對上'],
  ['afterOther', '揭曉後才拿，暗潮沒對上'],
  ['never', '從沒拿'],
] as const;

/** v08.events.tides: the betting groups per answer (matches where its tide was a candidate) and the overall effect of betting right. */
function betSection(s: SimStats): string[] {
  const e = s.v08.events;
  const answers = Object.keys(TIDE_ANSWER).map((k) => TIDE_ANSWER[k]!).filter((a) => e.bets[a] !== undefined);
  if (answers.length === 0) return [];
  const cell = (g: { seats: number; wins: number }) => `${g.seats}（${pct(g.wins, g.seats)}）`;
  return [
    '',
    '押注（只算該解法對應的暗潮是兩個候選之一的對局；格內＝座位數（勝率））：',
    '',
    ...table(
      ['解法', ...BET_GROUPS.map(([, label]) => label)],
      answers.map((a) => [ANSWER_LABELS[a]!, ...BET_GROUPS.map(([key]) => cell(e.bets[a]![key]))]),
    ),
    '',
    `- 押對任一種暗潮的座位：${cell(e.betRight)}；其他座位：${cell(e.betOthers)}。`,
  ];
}
const TIDE_ORDER = ['storm', 'pirate', 'inspection', 'crash'] as const;
/** The answer that matches each tide kind (查緝潮 also has the own-ship smuggler cover, its own row). */
const TIDE_ANSWER: Record<string, string> = { storm: 'build:repairyard', pirate: 'build:armory', inspection: 'open:hidden', crash: 'build:tradehouse' };
const ANSWER_LABELS: Record<string, string> = { 'build:repairyard': '修船廠', 'build:armory': '軍械庫', 'open:hidden': '幽靈號技能', 'build:tradehouse': '商行' };
const TRIGGER_EFFECTS = ['repairyard', 'armory', 'armory-armed', 'armory-counter', 'tradehouse', 'tradehouse-premium', 'tradehouse-buyout', 'inspected'] as const;

/** V0.8 prototype (v08.events.tides / lateCards): tide counts, matching answers and phase I vs phase II triggers. */
function tideSection(s: SimStats, rules: Rules, bets: boolean): string[] {
  const TIDE_LABELS = tideLabels(rules);
  const TRIGGERS = triggerEffects(rules);
  const tides = s.v08.events.tides;
  const late = s.v08.events.lateCards;
  const lateLine = Object.keys(late).length === 0 ? [] : [`- 第二階段單面牌：${Object.entries(late).map(([k, n]) => `${FINAL_LABELS[k] ?? k} ${n}（每局 ${per(n, s.matches)}）`).join('、')}。`];
  if (Object.keys(tides).length === 0) return lateLine.length === 0 ? [] : ['', ...lateLine];
  const kinds = TIDE_ORDER.filter((k) => tides[k] !== undefined);
  const otherRate = (kind: string, answer: string) => {
    const others = kinds.filter((k) => k !== kind);
    const seats = others.reduce((n, k) => n + tides[k]!.seats, 0);
    return pct(others.reduce((n, k) => n + (tides[k]!.answers[answer]?.seats ?? 0), 0), seats);
  };
  const rows = kinds.flatMap((k) => {
    const t = tides[k]!;
    const answer = TIDE_ANSWER[k]!;
    const a = t.answers[answer]!;
    const main = [TIDE_LABELS[k]!, t.matches, ANSWER_LABELS[answer]!, pct(a.seats, t.seats), otherRate(k, answer), pct(a.wins, a.seats), pct(t.matches - a.wins, t.seats - a.seats), `${a.before}／${a.after}`];
    if (k !== 'inspection') return [main];
    const others = kinds.filter((x) => x !== k);
    const otherCover = pct(others.reduce((n, x) => n + tides[x]!.coverSeats, 0), others.reduce((n, x) => n + tides[x]!.seats, 0));
    return [main, ['', '', '第二階段自家走私掩護', pct(t.coverSeats, t.seats), otherCover, pct(t.coverWins, t.coverSeats), pct(t.matches - t.coverWins, t.seats - t.coverSeats), '—']];
  });
  const perRound = (n: number, rounds: number) => per(n, rounds);
  return [
    '',
    '暗潮種類（v08.events.tides）：',
    '',
    `- 揭曉的暗潮：${kinds.map((k) => `${TIDE_LABELS[k]} ${tides[k]!.matches}（${pct(tides[k]!.matches, s.matches)}）`).join('、')}。`,
    ...lateLine,
    '',
    ...table(['暗潮', '局數', '對應解法', '採用率（本潮）', '採用率（其他潮）', '採用者勝率', '未採用者勝率', '揭曉前／後採用'], rows),
    '',
    '效果觸發（每回合次數，第一階段＝到暗潮將至那回合為止，第二階段＝之後含最終回合）：',
    '',
    ...table(
      ['暗潮', '階段一回合', '階段二回合', ...TRIGGERS.map((e) => `${EFFECT_LABELS[e]} 一／二`), '自家走私掩護 一／二'],
      kinds.map((k) => {
        const t = tides[k]!;
        return [
          TIDE_LABELS[k]!,
          t.phaseOneRounds,
          t.phaseTwoRounds,
          ...TRIGGERS.map((e) => `${perRound(t.triggers[e]?.one ?? 0, t.phaseOneRounds)}／${perRound(t.triggers[e]?.two ?? 0, t.phaseTwoRounds)}`),
          `${perRound(t.covers.one, t.phaseOneRounds)}／${perRound(t.covers.two, t.phaseTwoRounds)}`,
        ];
      }),
    ),
    ...(bets ? betSection(s) : []),
  ];
}

/** V0.8 prototype (v08.events): match lengths, phase II, final effects, 暗潮將至 losses and boss events. */
function eventsSection(s: SimStats, rules: Rules, bets: boolean): string[] {
  const e = s.v08.events;
  const dist = (counts: Record<number, number>) =>
    Object.entries(counts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, n]) => `${k}：${pct(n, s.matches)}`)
      .join('、');
  const mean = (counts: Record<number, number>) => per(Object.entries(counts).reduce((sum, [k, n]) => sum + Number(k) * n, 0), Object.values(counts).reduce((a, b) => a + b, 0));
  const lost = GOODS.reduce((sum, g) => sum + (e.darkTideLost[g] ?? 0), 0);
  const boss = Object.values(e.boss).reduce((a, b) => a + b, 0);
  return [
    '事件牌庫與兩階段（v08.events）：',
    '',
    `- 對局長度（回合）：${dist(e.lengths)}；平均 ${mean(e.lengths)} 回合。`,
    `- 暗潮將至出現的回合：${dist(e.darkTideRounds)}；最終回合：${dist(e.finalRounds)}。`,
    `- 第二階段回合數（暗潮將至的下一回合到最後一回合，含最終回合）：${dist(e.phaseTwo)}；平均 ${mean(e.phaseTwo)}；其中翻到首領事件的回合平均每局 ${per(e.bossRounds, s.matches)}。`,
    `- 最終效果：${Object.entries(e.finalEffects)
      .map(([k, n]) => `${FINAL_LABELS[k] ?? k} ${n}（${pct(n, s.matches)}）`)
      .join('、')}。`,
    `- 暗潮將至倉庫損失：每局 ${per(lost, s.matches)} 單位（每座位 ${per(lost, s.seats)}）：${GOODS.map((g) => `${GOOD_LABELS[g]} ${per(e.darkTideLost[g] ?? 0, s.matches)}`).join('、')}。`,
    '',
    ...table(
      ['首領事件', '原事件', '次數', '每局', '佔首領回合'],
      Object.keys(VOYAGE_EVENT_LABELS).map((k) => [bossLabel(rules, k), VOYAGE_EVENT_LABELS[k]!, e.boss[k] ?? 0, per(e.boss[k] ?? 0, s.matches), pct(e.boss[k] ?? 0, boss)]),
    ),
    ...(rules.v08.events.flipOnlyTideCard === 1 ? ['', '- 第二階段只有與暗潮對應的那張事件牌翻成首領版（v08.events.flipOnlyTideCard）；月黑風高、順風不會翻。'] : []),
    ...tideSection(s, rules, bets),
  ];
}

/** V0.8 prototype section: ship types, crates, material adoption, effects and price moves. */
function v08Section(options: Options, s: SimStats): string[] {
  const v = s.v08;
  const strategies = [...new Set(options.lineup)];
  const materialKeys = [...new Set(Object.values(v.materials).flatMap((m) => Object.keys(m)))].sort();
  const totalShips = Object.values(s.shipTypes).reduce((n, e) => n + e.count, 0);
  return [
    '## 5. V0.8 原型（實驗，不是規則）',
    '',
    '船型：',
    '',
    ...table(
      ['船型', '出航', '佔比', '沉沒率', '每艘裝箱（含私貨）', '其中私貨', '抵達船平均丟箱', '加注次數'],
      SHIP_TYPE_IDS.map((t) => {
        const e = s.shipTypes[t] ?? { count: 0, sank: 0, sales: 0, units: 0 };
        const c = v.crates[t] ?? { loaded: 0, privateLoaded: 0, lost: 0, raised: 0 };
        return [SHIP_LABELS[t]!, e.count, pct(e.count, totalShips), pct(e.sank, e.count), per(c.loaded + c.privateLoaded, e.count), per(c.privateLoaded, e.count), per(c.lost, e.count - e.sank), c.raised];
      }),
    ),
    '',
    '各策略的船型使用（佔該策略出航次數）：',
    '',
    ...table(
      ['策略', ...SHIP_TYPE_IDS.map((t) => SHIP_LABELS[t]!)],
      strategies.map((st) => {
        const byType = v.typeByStrategy[st] ?? {};
        const total = Object.values(byType).reduce((a, b) => a + b, 0);
        return [st, ...SHIP_TYPE_IDS.map((t) => pct(byType[t] ?? 0, total))];
      }),
    ),
    '',
    '材料行動（每座位次數／平均回合）：',
    '',
    ...table(
      ['行動', ...strategies],
      materialKeys.map((key) => [
        key,
        ...strategies.map((st) => {
          const e = v.materials[st]?.[key];
          const seats = s.byStrategy[st]?.seats ?? 0;
          return e === undefined ? '—' : `${per(e.count, seats)}／R${per(e.roundSum, e.count)}`;
        }),
      ]),
    ),
    '',
    '技能與建築的效果（全部對局合計）：',
    '',
    ...table(
      ['效果', '次數', '每局', '貨箱', 'G 合計', '每次 G'],
      Object.entries(v.effects)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, e]) => [EFFECT_LABELS[k] ?? k, e.count, per(e.count, s.matches), e.crates, e.value, per(e.value, e.count)]),
    ),
    '',
    '價格變動（每種商品每回合）：',
    '',
    ...table(
      ['商品', '上漲', '持平', '下跌'],
      GOODS.map((g) => {
        const m = v.priceMoves[g]!;
        const total = m.up + m.flat + m.down;
        return [GOOD_LABELS[g]!, pct(m.up, total), pct(m.flat, total), pct(m.down, total)];
      }),
    ),
    ...(options.rules.v08.events.enabled === 1 ? ['', ...eventsSection(s, options.rules, options.bets)] : []),
  ];
}

function report(options: Options, s: SimStats): string {
  const { rules } = options;
  return [
    `# 黑市商會 模擬報表（${rules.version}）`,
    '',
    `- 規則：${rules.version}${options.overrides.length > 0 ? `，覆寫：${options.overrides.join('、')}` : ''}`,
    `- 對局數：${s.matches}；人數：${options.players}；起始 seed：${options.seed}；陣容（每局輪換座位）：${options.lineup.join('、')}`,
    '',
    ...winSection(options, s),
    '',
    '## 2. 建築',
    '',
    ...table(
      ['建築', '建造次數', '建造率（每座位）', '平均建造回合'],
      BUILDING_IDS.map((b) => [BUILDING_LABELS[b]!, s.buildings[b]!.count, pct(s.buildings[b]!.count, s.seats), per(s.buildings[b]!.roundSum, s.buildings[b]!.count)]),
    ),
    '',
    `- 每名玩家終局平均持有 ${per(BUILDING_IDS.reduce((sum, b) => sum + s.buildings[b]!.count, 0), s.seats)} 棟。`,
    '',
    ...marketSection(options, s),
    '',
    ...roleSection(s),
    '',
    ...(v08On(rules) ? [...v08Section(options, s), ''] : []),
    '> 模擬結果只反映目前 Bot 的決策方式，作為使用者決策的參考，不代表真人玩家行為。',
  ].join('\n');
}

/** One row: overrides, win spread, mean wealth, sailing, building rates, role shares, pirate net. */
function summaryRow(options: Options, s: SimStats): string {
  const winRates = [...new Set(options.lineup)].map((st) => {
    const e = s.byStrategy[st];
    return e === undefined || e.seats === 0 ? 0 : e.wins / e.seats;
  });
  const wealth = Object.values(s.byStrategy).reduce((sum, e) => sum + e.wealth, 0) / Math.max(1, s.seats);
  const buildingRates = BUILDING_IDS.map((b) => pct(s.buildings[b]!.count, s.seats)).join(' / ');
  const roleRates = ROLE_IDS.map((r) => pct(s.roles[r] ?? 0, s.playerRounds)).join(' / ');
  return `| ${options.overrides.join(' ') || '現行規則'} | ${(100 * Math.min(...winRates)).toFixed(1)}–${(100 * Math.max(...winRates)).toFixed(1)}% | ${wealth.toFixed(0)} | ${pct(
    s.ships,
    s.playerRounds,
  )} | ${buildingRates} | ${roleRates} | ${pirateNet(s).toFixed(0)} |${v08On(options.rules) ? v08Summary(s) + tideLossSummary(options.rules, s) + (options.bets ? betSummary(options.rules, s) : '') : ''}`;
}

/** V0.8 prototype extra columns: ship sink rate, ship-type shares, material actions per seat, leftover goods per seat. */
function v08Summary(s: SimStats): string {
  const ships = Object.values(s.shipTypes).reduce((n, e) => n + e.count, 0);
  const sank = Object.values(s.shipTypes).reduce((n, e) => n + e.sank, 0);
  const shares = SHIP_TYPE_IDS.map((t) => pct(s.shipTypes[t]?.count ?? 0, ships)).join(' / ');
  const materials = Object.values(s.v08.materials).reduce((n, m) => n + Object.values(m).reduce((k, e) => k + e.count, 0), 0);
  const events = s.v08.events;
  const lengths = Object.entries(events.lengths).reduce((sum, [k, n]) => sum + Number(k) * n, 0);
  // v08.events: mean match length, and the 黑市大開 / 最後一搏 split.
  const phases = Object.keys(events.lengths).length === 0 ? '' : ` ${per(lengths, s.matches)} R | ${events.finalEffects['open-market'] ?? 0} / ${events.finalEffects['last-gamble'] ?? 0} |`;
  return ` ${pct(sank, ships)} | ${shares} | ${per(materials, s.seats)} | ${per(s.unsoldUnits, s.seats)} |${phases}${tideSummary(s)}`;
}

/** 風暴潮 / 海盜潮 realigned (only with those settings on): extra crates lost to the storm tide and arrival loots per match. */
function tideLossSummary(rules: Rules, s: SimStats): string {
  const e = rules.v08.events;
  if (e.tideStormExtraLoss <= 0 && e.tidePirateArrivalLoot <= 0) return '';
  const fx = s.v08.effects;
  return ` ${per(fx['storm-tide']?.crates ?? 0, s.matches)} 箱 / ${per(fx['pirate-tide']?.count ?? 0, s.matches)} 次 |`;
}

/** Tide shields and bets (with --bets or a shield on): shield triggers per match (storm / pirate / crash), bet-right vs other win rates. */
function betSummary(rules: Rules, s: SimStats): string {
  if (rules.v08.events.tides !== 1) return '';
  const fx = s.v08.effects;
  const e = s.v08.events;
  const shields = ['storm-shield', 'pirate-shield', 'crash-shield'].map((k) => per(fx[k]?.count ?? 0, s.matches)).join(' / ');
  return ` ${shields} | 押對 ${pct(e.betRight.wins, e.betRight.seats)}（${per(e.betRight.seats, s.seats)}）／其他 ${pct(e.betOthers.wins, e.betOthers.seats)} |`;
}

/** v08.events.tides / finalBoth: tide counts (storm / pirate / inspection / crash), matching-answer adoption, final markets. */
function tideSummary(s: SimStats): string {
  const tides = s.v08.events.tides;
  if (Object.keys(tides).length === 0) return '';
  const counts = TIDE_ORDER.map((k) => tides[k]?.matches ?? 0).join(' / ');
  const adoption = TIDE_ORDER.map((k) => {
    const t = tides[k];
    return t === undefined ? '—' : pct(t.answers[TIDE_ANSWER[k]!]!.seats, t.seats);
  }).join(' / ');
  return ` ${counts} | ${adoption} | ${s.v08.events.finalEffects['final-market'] ?? 0} |`;
}

const options = parseOptions();
const stats = run(options);
console.log(options.summary ? summaryRow(options, stats) : report(options, stats));
