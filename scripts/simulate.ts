/**
 * Runs many bot-only matches and prints a Markdown balance report.
 * Usage: npm run simulate -- [--matches 1000] [--players 4] [--seed 1]
 *        [--lineup balanced,cautious,aggressive,opportunist]
 *        [--set roles.pirate.modifier=-1 ...] [--summary]
 * `--set` overrides any numeric rule (repeatable) to test balance ideas without editing
 * the rules; `--summary` prints one Markdown table row of key metrics instead of a report.
 * Seats rotate every match so each strategy plays every seat position.
 */
import { BOT_STRATEGIES, type BotStrategy } from '../src/bots';
import { RULES_V06, type MarketEventId, type Rules } from '../src/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../src/match';
import { MARKET_EVENT_LABELS } from '../src/ui/labels';
import { addMatch, emptyStats, type SeatRecord, type SimStats } from './sim-stats';

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
  const lineup = (get('lineup') ?? 'balanced,cautious,aggressive,opportunist').split(',') as BotStrategy[];
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
    rules: applyOverrides(RULES_V06, overrides),
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
  const stats = emptyStats();
  for (let i = 0; i < options.matches; i += 1) {
    const seats = seatsFor(options, i);
    const setup = setupFromSeats({ seed: options.seed + i, seats, rules: options.rules });
    const log = runMatchSync(setup, setup.bots);
    const records: SeatRecord[] = setup.players.map((p, k) => ({
      playerId: p.id,
      strategy: seats[k]!.kind === 'bot' ? (seats[k] as { strategy: string }).strategy : 'human',
    }));
    addMatch(stats, log, records);
  }
  return stats;
}

// ── Formatting ────────────────────────────────────────────────────────────────

const pct = (part: number, whole: number) => (whole === 0 ? '—' : `${((100 * part) / whole).toFixed(1)}%`);
const mean = (values: readonly number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);
const sum = (map: ReadonlyMap<unknown, number>) => [...map.values()].reduce((a, b) => a + b, 0);

function table(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string[] {
  return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)];
}

function report(options: Options, s: SimStats): string {
  const strategies = [...new Set(options.lineup)];
  const lines: string[] = [
    `# 黑市商會 模擬報表`,
    '',
    `- 規則：${RULES_V06.version}（完整規則）${options.overrides.length > 0 ? `，覆寫：${options.overrides.join('、')}` : ''}`,
    `- 對局數：${s.matches}；人數：${options.players}；起始 seed：${options.seed}；玩家回合數：${s.playerRounds}`,
    `- 陣容（每局輪換座位）：${options.lineup.join('、')}`,
    '',
    '## 1. 勝率與財富',
    '',
    ...table(
      ['策略', '座位數', '勝率', '平均財富', '平均持有資產數'],
      strategies.map((st) => [
        st,
        s.seatsPlayed.get(st) ?? 0,
        pct(s.wins.get(st) ?? 0, s.seatsPlayed.get(st) ?? 0),
        mean(s.wealth.get(st) ?? []).toFixed(0),
        mean(s.assetsHeld.get(st) ?? []).toFixed(2),
      ]),
    ),
    '',
    '## 2. 出航選擇（每名玩家每回合）',
    '',
    ...table(
      ['市場事件', '合資', '獨資', '不出航'],
      [
        ['全部', ...(['joint', 'solo', 'stay'] as const).map((v) => pct(s.voyages.get(v) ?? 0, sum(s.voyages)))],
        ...[...s.voyagesByMarket.entries()].map(([market, m]) => [
          MARKET_EVENT_LABELS[market as MarketEventId],
          ...(['joint', 'solo', 'stay'] as const).map((v) => pct(m.get(v) ?? 0, sum(m))),
        ]),
      ],
    ),
    '',
    '## 3. 航行結果',
    '',
    ...table(
      ['船型', '艘數', '抵達率'],
      (['solo', 'joint'] as const).map((k) => {
        const m = s.ships.get(k) ?? new Map();
        return [k === 'solo' ? '獨資' : '合資', sum(m), pct(m.get('arrived') ?? 0, sum(m))];
      }),
    ),
    '',
    '## 4. 角色選擇（每名玩家每回合）',
    '',
    ...table(
      ['策略', '不部署', '情報商人', '護衛', '海盜', '走私商人'],
      strategies.map((st) => {
        const m = s.roles.get(st) ?? new Map();
        return [st, ...(['none', 'intel', 'guard', 'pirate', 'smuggler'] as const).map((r) => pct(m.get(r) ?? 0, sum(m)))];
      }),
    ),
    '',
    `- 護衛：保護自己的船 ${s.guardOwnShip} 次、保護別人的船 ${s.guardOtherShip} 次。`,
    `- 海盜：共 ${s.pirateDeployments} 次，目標沉沒率 ${pct(s.pirateSinks, s.pirateDeployments)}；攻擊自己的合資船（背叛）${s.betrayals} 次；每次平均淨收益 ${(
      (s.pirateNet - s.pirateDeployments * RULES_V06.roles.pirate.fee) / Math.max(1, s.pirateDeployments)
    ).toFixed(0)} G。`,
    `- 走私：合資船東選擇走私的比例 ${pct(sum(s.smuggling), s.jointOwnerRounds)}；結局：取走 ${s.smuggling.get('taken') ?? 0}、被查獲 ${
      s.smuggling.get('confiscated') ?? 0
    }、被搶 ${s.smuggling.get('seized') ?? 0}、沉沒 ${s.smuggling.get('lost') ?? 0}。`,
    '',
    '## 5. 資產',
    '',
    ...table(
      ['資產', '購買次數', '平均購買回合'],
      ['shipyard', 'insurance', 'salvage', 'exchange'].map((a) => [
        { shipyard: '造船廠', insurance: '航運保險', salvage: '打撈公司', exchange: '貿易交易所' }[a]!,
        s.purchases.get(a) ?? 0,
        mean(s.purchaseRounds.get(a) ?? []).toFixed(2),
      ]),
    ),
    '',
    `- 每名玩家最終持有資產數：平均 ${mean([...s.assetsHeld.values()].flat()).toFixed(2)}（設計目標 2～3）。`,
    '',
    '> 模擬結果只反映目前 Bot 的決策方式，作為使用者決策的參考，不代表真人玩家行為。',
  ];
  return lines.join('\n');
}

/** One table row: label, arrival, voyages, role shares, pirate net, win-rate spread, assets. */
function summaryRow(options: Options, s: SimStats): string {
  const allShips = [...s.ships.values()].reduce((acc, m) => acc + sum(m), 0);
  const arrived = [...s.ships.values()].reduce((acc, m) => acc + (m.get('arrived') ?? 0), 0);
  const roles = new Map<string, number>();
  s.roles.forEach((m) => m.forEach((v, k) => roles.set(k, (roles.get(k) ?? 0) + v)));
  const roleTotal = sum(roles);
  const winRates = [...new Set(options.lineup)].map((st) => (s.wins.get(st) ?? 0) / Math.max(1, s.seatsPlayed.get(st) ?? 0));
  const pirateNet = (s.pirateNet - s.pirateDeployments * options.rules.roles.pirate.fee) / Math.max(1, s.pirateDeployments);
  return `| ${options.overrides.join(' ') || '現行規則'} | ${pct(arrived, allShips)} | ${pct(s.voyages.get('joint') ?? 0, sum(s.voyages))} | ${[
    'none',
    'intel',
    'guard',
    'pirate',
    'smuggler',
  ]
    .map((r) => pct(roles.get(r) ?? 0, roleTotal))
    .join(' | ')} | ${pirateNet.toFixed(0)} | ${(100 * Math.min(...winRates)).toFixed(1)}–${(100 * Math.max(...winRates)).toFixed(1)}% | ${mean(
    [...s.assetsHeld.values()].flat(),
  ).toFixed(2)} |`;
}

const options = parseOptions();
const stats = run(options);
console.log(options.summary ? summaryRow(options, stats) : report(options, stats));
