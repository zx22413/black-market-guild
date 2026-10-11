/**
 * Runs bot-only matches of the economy prototype (docs/proposals/2026-10-economy-rework.md §13)
 * and prints a Markdown report.
 * Usage: npm run simulate:economy -- [--mode A|B] [--matches 1000] [--players 4] [--seed 1]
 *        [--lineup balanced,cautious,aggressive,builder] [--set capacity.base=3 ...] [--summary]
 *        [--preset round5|…|round11]
 * A preset is a named list of `--set` overrides applied before any explicit `--set`.
 * Seats rotate every match so each strategy plays every seat position.
 */
import { BUILDING_IDS, MATERIALS, economyRules, priceAt, runEconomyMatch, type EconomyMode, type EconomyRules } from '../src/proto/economy';
import { ECONOMY_BOT_STRATEGIES, createEconomyBot, type EconomyBotStrategy } from '../src/proto/economy/bots';
import { addEconomyMatch, emptyEconomyStats, type EconomyStats } from './economy-stats';

interface Options {
  readonly mode: EconomyMode;
  readonly matches: number;
  readonly players: number;
  readonly seed: number;
  readonly lineup: readonly EconomyBotStrategy[];
  readonly overrides: readonly string[];
  readonly rules: EconomyRules;
  readonly summary: boolean;
}

/** Returns a copy of the rules with `path=value` numeric overrides applied. */
function applyOverrides(base: EconomyRules, overrides: readonly string[]): EconomyRules {
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
  return rules as unknown as EconomyRules;
}

/** Round 5 (proposal §18): spice, contraband, the broker, a two-building limit and a 20 G commission. */
const ROUND5 = [
    'production.spice=1',
    'production.contraband=1',
    'productionEvery.contraband=2',
    'price.volatility.spice=2',
    'demand.min.spice=1',
    'demand.max.spice=3',
    'demand.min.contraband=0',
    'demand.max.contraband=1',
    'capacity.base=3',
    'buildings.broker.enabled=1',
    'maxBuildingsPerPlayer=2',
    'buildings.exchange.variant=1',
  'buildings.exchange.commissionPerUnit=20',
];

const ROUND8 = [
  ...ROUND5,
  'roles.smuggler.coversSeizable=1',
  'roles.guard.escortWhenSeizing=0',
  'roles.smuggler.caughtFine=100',
  'buildings.exchange.commissionPerUnit=15',
  'roles.smuggler.anonymous=0',
  'roles.smuggler.goodsValue=100',
  'buildings.insurance.keepPerRound=1',
];

const ROUND9 = [...ROUND8, 'buildings.broker.enabled=0', 'roles.broker.enabled=1', 'roles.broker.payout=100'];

const ROUND10 = [
  ...ROUND9,
  'demand.extraPerPlayerAbove3=0',
  'demand.max.wood=2',
  'demand.max.iron=2',
  'demand.max.spice=2',
  'demand.extraMax.wood=1',
  'demand.extraMax.iron=1',
  'demand.extraMax.spice=1',
];

const PRESETS: Readonly<Record<string, readonly string[]>> = {
  round5: [...ROUND5, 'roles.smuggler.coversSeizable=0', 'roles.guard.escortWhenSeizing=1'],
  /** Round 6 (proposal §19): smugglers cover contraband; confiscating guards get no escort fee. */
  round6: [...ROUND5, 'roles.smuggler.coversSeizable=1', 'roles.guard.escortWhenSeizing=0'],
  /** Round 7 (proposal §20): round 6 with a 100 G smuggling fine and a 15 G commission. */
  round7: [
    ...ROUND5,
    'roles.smuggler.coversSeizable=1',
    'roles.guard.escortWhenSeizing=0',
    'roles.smuggler.caughtFine=100',
    'buildings.exchange.commissionPerUnit=15',
  ],
  /** Round 8 (proposal §21): round 7 with public 100 G smuggling and one insured unit per round. */
  round8: ROUND8,
  /** Round 9 (proposal §22): round 8 with the broker as a role (bet on a price move, 100 G) instead of a building. */
  round9: ROUND9,
  /** Round 10 (proposal §23): round 9 with demand 1-2 for 3 players and 1-3 for 4 (contraband 0-1 for both). */
  round10: ROUND10,
  /** Round 11 (proposal §25): round 10 with a 75 G broker and wood and iron produced every other round. */
  round11: [...ROUND10, 'roles.broker.fee=75', 'productionEvery.wood=2', 'productionEvery.iron=2'],
};


function parseOptions(): Options {
  const argv = (globalThis as { process?: { argv?: string[] } }).process?.argv?.slice(2) ?? [];
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const mode = (get('mode') ?? 'A').toUpperCase();
  if (mode !== 'A' && mode !== 'B') {
    throw new Error(`--mode must be A or B, got ${mode}`);
  }
  const preset = get('preset');
  if (preset !== undefined && PRESETS[preset] === undefined) {
    throw new Error(`unknown preset ${preset}; choose from ${Object.keys(PRESETS).join(', ')}`);
  }
  const explicit = argv.flatMap((arg, i) => (arg === '--set' && argv[i + 1] ? [argv[i + 1]!] : []));
  const overrides = [...(preset === undefined ? [] : PRESETS[preset]!), ...explicit];
  const lineup = (get('lineup') ?? 'balanced,cautious,aggressive,builder').split(',') as EconomyBotStrategy[];
  const unknown = lineup.filter((s) => !(ECONOMY_BOT_STRATEGIES as readonly string[]).includes(s));
  if (unknown.length > 0) {
    throw new Error(`unknown strategies: ${unknown.join(', ')}; choose from ${ECONOMY_BOT_STRATEGIES.join(', ')}`);
  }
  const options = {
    mode,
    matches: Number.parseInt(get('matches') ?? '1000', 10),
    players: Number.parseInt(get('players') ?? '4', 10),
    seed: Number.parseInt(get('seed') ?? '1', 10),
    lineup,
    overrides,
    rules: applyOverrides(economyRules(mode), overrides),
    summary: argv.includes('--summary'),
  } as const;
  if (![options.matches, options.players, options.seed].every(Number.isInteger)) {
    throw new Error('--matches, --players and --seed must be integers');
  }
  return options;
}

function run(options: Options): EconomyStats {
  const stats = emptyEconomyStats(options.rules.price.steps);
  for (let i = 0; i < options.matches; i += 1) {
    const strategies = Array.from({ length: options.players }, (_, k) => options.lineup[(i + k) % options.lineup.length]!);
    const seats = strategies.map((strategy, k) => ({
      id: `p${k + 1}`,
      name: `${strategy}#${k + 1}`,
      bot: createEconomyBot(strategy, options.seed * 1000 + i * 10 + k),
    }));
    const result = runEconomyMatch(options.seed + i, seats, options.rules);
    addEconomyMatch(stats, result, (id) => strategies[Number(id.slice(1)) - 1]!);
  }
  return stats;
}

// ── Formatting ────────────────────────────────────────────────────────────────

const pct = (part: number, whole: number) => (whole === 0 ? '—' : `${((100 * part) / whole).toFixed(1)}%`);
const per = (part: number, whole: number) => (whole === 0 ? '—' : (part / whole).toFixed(2));

function table(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string[] {
  return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)];
}

const BUILDING_LABELS: Record<string, string> = { shipyard: '造船廠', insurance: '航運保險', salvage: '打撈公司', exchange: '貿易交易所', broker: '牙行' };
const ROLE_LABELS: Record<string, string> = { intel: '情報商人', guard: '護衛', pirate: '海盜', smuggler: '走私商人', broker: '牙人' };
const MATERIAL_LABELS: Record<string, string> = { wood: '木材', iron: '鐵礦', spice: '香料', contraband: '違禁品' };

function totalRoles(s: EconomyStats): number {
  return Object.values(s.roles).reduce((a, b) => a + b, 0);
}

function pirateNet(s: EconomyStats): number {
  return (s.pirateIncome - s.pirateFees) / Math.max(1, s.roles.pirate ?? 0);
}

function report(options: Options, s: EconomyStats): string {
  const { rules } = options;
  const strategies = [...new Set(options.lineup)];
  const roleCount = totalRoles(s);
  const inPlay = MATERIALS.filter((m) => rules.demand.max[m] > 0);
  const priceRows = inPlay.map((m) => {
    const counts = s.priceSteps[m]!;
    const total = counts.reduce((a, b) => a + b, 0);
    return [MATERIAL_LABELS[m]!, ...counts.map((c) => pct(c, total))];
  });
  return [
    `# 黑市商會 經濟原型模擬報表（方案 ${options.mode}）`,
    '',
    `- 規則：${rules.version}（原型，非正式規則）${options.overrides.length > 0 ? `，覆寫：${options.overrides.join('、')}` : ''}`,
    `- 對局數：${s.matches}；人數：${options.players}；起始 seed：${options.seed}；陣容（每局輪換座位）：${options.lineup.join('、')}`,
    `- 可裝貨量 ${rules.capacity.base}（造船廠 +${rules.capacity.shipyardBonus}）；${
      options.mode === 'A' ? `出航成本 ${rules.ownShip.cost} G；護航費 ${rules.roles.guard.escortFee} G` : `運費每單位 ${rules.neutralShip.freightPerUnit} G`
    }`,
    '',
    '## 1. 勝率與財富',
    '',
    ...table(
      ['策略', '座位數', '勝率', '平均財富'],
      strategies.map((st) => {
        const e = s.byStrategy[st] ?? { seats: 0, wins: 0, wealth: 0 };
        return [st, e.seats, pct(e.wins, e.seats), per(e.wealth, e.seats)];
      }),
    ),
    '',
    `- 每局最高與最低財富差距平均 ${per(s.wealthSpread, s.matches)} G。`,
    '',
    '## 2. 建築',
    '',
    ...table(
      ['建築', '建造次數', '建造率（每座位）', '平均建造回合'],
      BUILDING_IDS.map((b) => [BUILDING_LABELS[b]!, s.buildings[b]!.count, pct(s.buildings[b]!.count, s.seats), per(s.buildings[b]!.roundSum, s.buildings[b]!.count)]),
    ),
    '',
    `- 每名玩家終局平均持有 ${per(BUILDING_IDS.reduce((sum, b) => sum + s.buildings[b]!.count, 0), s.seats)} 棟（目標 2～3）。`,
    '',
    '## 3. 出航與市場',
    '',
    `- 有裝貨出航的玩家回合：${pct(s.loadingRounds, s.playerRounds)}；平均每回合到港前裝運 ${per(s.unitsShipped, s.matches * rules.rounds)} 單位。`,
    `- 到港量對需求（每種材料每回合）：少於需求 ${pct(s.demandVsArrived.under, s.matches * rules.rounds * inPlay.length)}、剛好 ${pct(
      s.demandVsArrived.exact,
      s.matches * rules.rounds * inPlay.length,
    )}、多於需求 ${pct(s.demandVsArrived.over, s.matches * rules.rounds * inPlay.length)}。`,
    `- 終局每名玩家平均剩下 ${per(s.unsoldUnits, s.seats)} 單位材料（歸零）：${inPlay
      .map((m) => `${MATERIAL_LABELS[m]} ${per(s.unsoldByMaterial[m] ?? 0, s.seats)}`)
      .join('、')}。`,
    '',
    '回合結束時的價格分布：',
    '',
    ...table(['材料', ...Array.from({ length: rules.price.steps }, (_, k) => `${priceAt(rules, k)} G`)], priceRows),
    '',
    `- 牙人：押注 ${s.roles.broker ?? 0} 次，押中 ${pct(s.betsWon, s.roles.broker ?? 0)}。`,
    `- 牙行調整需求 ${s.manipulations} 次（每局平均 ${per(s.manipulations, s.matches)}）；違禁品被護衛沒收 ${s.contrabandSeizedUnits} 單位、${s.contrabandSeizedCash} G。`,
    `- 交易所（效果 ${['跌價保護', '做市佣金', '倉庫直售'][rules.buildings.exchange.variant] ?? rules.buildings.exchange.variant}）：佣金共 ${s.commission} G；直售 ${s.directUnits} 單位、${s.directCash} G。`,
    '',
    '## 4. 角色',
    '',
    ...table(
      ['角色', '部署次數', '佔所有玩家回合'],
      Object.entries(s.roles).map(([role, n]) => [ROLE_LABELS[role] ?? role, n, pct(n, s.playerRounds)]),
    ),
    '',
    `- 護衛守「自己沒有貨的船」：${pct(s.guardOthers, s.roles.guard ?? 0)}（V0.6 約 23%）。`,
    `- 走私商人：掩護自己違禁品 ${s.smugglerCovers} 次、上別人船走私 ${(s.roles.smuggler ?? 0) - s.smugglerCovers} 次；掩護佔走私 ${pct(
      s.smugglerCovers,
      s.roles.smuggler ?? 0,
    )}；有違禁品的出航中被掩護 ${pct(s.coveredContrabandShips, s.contrabandShips)}。`,
    `- 海盜：目標沉沒率 ${pct(s.pirateSinks, s.roles.pirate ?? 0)}；每次平均淨收益 ${pirateNet(s).toFixed(0)} G。`,
    `- 護航費總額 ${s.escortFees} G；保險補償 ${s.insurance} G、保住 ${s.insuredKept} 單位；打撈 ${s.salvaged} 單位；走私取走 ${s.smuggled} G。共 ${roleCount} 次部署。`,
    '',
    '> 原型模擬只反映目前 Bot 的決策方式與暫定數值，作為比較方案的參考，不是規則。',
  ].join('\n');
}

/** One row: mode, overrides, building rates, guard-others, pirate share and net, sailing, win spread. */
function summaryRow(options: Options, s: EconomyStats): string {
  const winRates = [...new Set(options.lineup)].map((st) => {
    const e = s.byStrategy[st];
    return e === undefined || e.seats === 0 ? 0 : e.wins / e.seats;
  });
  const buildingRates = BUILDING_IDS.map((b) => pct(s.buildings[b]!.count, s.seats)).join(' / ');
  const label = options.overrides.join(' ') || '預設';
  return `| ${options.mode} | ${label.length > 60 ? `${label.slice(0, 57)}…` : label} | ${buildingRates} | ${pct(s.guardOthers, s.roles.guard ?? 0)} | ${pct(
    s.roles.pirate ?? 0,
    s.playerRounds,
  )} | ${pirateNet(s).toFixed(0)} | ${pct(s.loadingRounds, s.playerRounds)} | ${(100 * Math.min(...winRates)).toFixed(1)}–${(100 * Math.max(...winRates)).toFixed(1)}% |`;
}

const options = parseOptions();
const stats = run(options);
console.log(options.summary ? summaryRow(options, stats) : report(options, stats));
