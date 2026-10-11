/**
 * Runs many V0.7 bot-only matches and prints a Markdown balance report.
 * Usage: npm run simulate -- [--matches 1000] [--players 4] [--seed 1]
 *        [--lineup balanced,cautious,aggressive,builder]
 *        [--set roles.pirate.loot=150 ...] [--summary]
 * `--set` overrides any numeric rule (repeatable) to test balance ideas without editing
 * the rules; `--summary` prints one Markdown table row of key metrics instead of a report.
 * Seats rotate every match so each strategy plays every seat position.
 */
import { BOT_STRATEGIES, type BotStrategy } from '../src/v07/bots';
import { BUILDING_IDS, GOODS, ROLE_IDS, RULES_V07, priceAt, type Rules } from '../src/v07/game';
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
    rules: applyOverrides(RULES_V07, overrides),
    summary: argv.includes('--summary'),
  };
  if (![options.matches, options.players, options.seed].every(Number.isInteger)) {
    throw new Error('--matches, --players and --seed must be integers');
  }
  return options;
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
const ROLE_LABELS: Record<string, string> = { intel: '情報商人', guard: '護衛', pirate: '海盜', smuggler: '走私商人', broker: '莊家' };
const GOOD_LABELS: Record<string, string> = { wood: '木材', iron: '鐵礦', spice: '香料', arms: '軍火' };
const ISLAND_LABELS: Record<string, string> = {
  'spice-isles': '香料群島',
  'pirate-cove': '海盜灣',
  lumber: '林場島',
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
  const goodRounds = s.matches * rules.rounds * GOODS.length;
  return [
    '## 3. 出航與市場',
    '',
    `- 出航的玩家回合：${pct(s.ships, s.playerRounds)}；抵達率 ${pct(s.shipsArrived, s.ships)}；每艘平均 ${per(s.unitsShipped, s.ships)} 單位（軍火 ${per(
      s.armsShipped,
      s.ships,
    )}）；平均每回合裝運 ${per(s.unitsShipped, s.matches * rules.rounds)} 單位。`,
    `- 到港量對需求（每種商品每回合）：少於需求 ${pct(s.demandVsArrived.under, goodRounds)}、剛好 ${pct(s.demandVsArrived.exact, goodRounds)}、多於需求 ${pct(
      s.demandVsArrived.over,
      goodRounds,
    )}。`,
    `- 終局每名玩家平均剩下 ${per(s.unsoldUnits, s.seats)} 單位材料（不計分）：${GOODS.map((g) => `${GOOD_LABELS[g]} ${per(s.unsoldByGood[g] ?? 0, s.seats)}`).join('、')}。`,
    '',
    '回合結束時的價格分布：',
    '',
    ...table(
      ['商品', ...Array.from({ length: rules.price.steps }, (_, k) => `${priceAt(rules, k)} G`)],
      GOODS.map((g) => {
        const counts = s.priceSteps[g]!;
        const total = counts.reduce((a, b) => a + b, 0);
        return [GOOD_LABELS[g]!, ...counts.map((c) => pct(c, total))];
      }),
    ),
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
    `- 護衛守別人的船：${pct(s.guardOthers, s.roles.guard ?? 0)}；護航費總額 ${s.escortFees} G。`,
    `- 走私商人：掩護自己軍火 ${s.smugglerCovers} 次、上別人船走私 ${(s.roles.smuggler ?? 0) - s.smugglerCovers} 次（被抓 ${s.smugglersCaught} 人次，抽走 ${s.smuggled} G）；載軍火的船中有走私商人 ${pct(
      s.coveredArmsShips,
      s.armsShips,
    )}；軍火被沒收 ${s.armsConfiscatedUnits} 單位、${s.armsConfiscatedCash} G。`,
    `- 海盜：目標沉沒率 ${pct(s.pirateSinks, s.roles.pirate ?? 0)}；每次平均淨收益 ${pirateNet(s).toFixed(0)} G。`,
    `- 莊家：押注 ${s.roles.broker ?? 0} 次，押中 ${pct(s.betsWon, s.roles.broker ?? 0)}。情報商人重擲 ${s.intelRerolls} 艘（部署 ${s.roles.intel ?? 0} 次）。`,
    `- 保險保住 ${s.insuredKept} 單位；打撈 ${s.salvaged} 單位；交易所佣金 ${s.commission} G。`,
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
  )} | ${buildingRates} | ${roleRates} | ${pirateNet(s).toFixed(0)} |`;
}

const options = parseOptions();
const stats = run(options);
console.log(options.summary ? summaryRow(options, stats) : report(options, stats));
