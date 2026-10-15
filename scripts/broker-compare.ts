/**
 * Scratch experiment: value of forcing seat p1 to always deploy the broker (best-scoring action)
 * vs never deploying a role, for several broker price-control variants. Paired by seed.
 */
import type { Bot, BotStrategy } from '../src/v07/bots';
import { scoreAction } from '../src/v07/bots/heuristic';
import { PERSONALITIES } from '../src/v07/bots/personality';
import { RULES_V07, roleFee, type PlayerId, type Rules, type ShipId } from '../src/v07/game';
import { runMatchSync, setupFromSeats, type MatchLog, type SeatConfig } from '../src/v07/match';

const LINEUP: BotStrategy[] = ['balanced', 'cautious', 'aggressive', 'builder'];
const MATCHES = Number.parseInt((globalThis as { process?: { argv?: string[] } }).process?.argv?.[2] ?? '3000', 10);

interface Variant {
  readonly name: string;
  readonly targetSteps: number;
  readonly ownUp?: number;
}

const VARIANTS: Variant[] = [
  { name: '現行：只有押注', targetSteps: 0 },
  { name: '押注＋指定對手的船 2 格', targetSteps: 2 },
  { name: '押漲指定自己、押跌指定對手 2 格', targetSteps: 2, ownUp: 1 },
];

function rulesOf(v: Variant): Rules {
  return { ...RULES_V07, roles: { ...RULES_V07.roles, broker: { ...RULES_V07.roles.broker, targetSteps: v.targetSteps, targetOwnUp: v.ownUp ?? 0 } } };
}

function forced(inner: Bot, mode: 'none' | 'broker'): Bot {
  return {
    decide(ctx) {
      if (ctx.view.phase !== 'role-deployment') {
        return inner.decide(ctx);
      }
      const brokers = ctx.legalActions.filter((a) => a.type === 'deploy-role' && a.role === 'broker');
      if (mode === 'broker' && brokers.length > 0) {
        const scored = brokers.map((a) => ({ a, v: scoreAction(ctx.view, a, PERSONALITIES.balanced) }));
        return scored.reduce((best, x) => (x.v > best.v ? x : best)).a;
      }
      return inner.decide({ ...ctx, legalActions: ctx.legalActions.filter((a) => a.type === 'deploy-role' && a.role === null) });
    },
    ...(inner.onEvents === undefined ? {} : { onEvents: inner.onEvents.bind(inner) }),
    ...(inner.onPrivateEvent === undefined ? {} : { onPrivateEvent: inner.onPrivateEvent.bind(inner) }),
  };
}

function play(rules: Rules, mode: 'none' | 'broker', i: number): MatchLog {
  const seats: SeatConfig[] = Array.from({ length: 4 }, (_, k) => {
    const strategy = LINEUP[(i + k) % 4]!;
    return { kind: 'bot', name: `${strategy}#${k + 1}`, strategy };
  });
  const setup = setupFromSeats({ seed: 1 + i, seats, rules });
  return runMatchSync(setup, { ...setup.bots, p1: forced(setup.bots['p1']!, mode) });
}

interface Tally {
  income: number;
  fees: number;
  targeted: number;
  targetedOthers: number;
  lossOnOthers: number;
  withSmuggler: number;
  smugglerShips: number;
  smugglerShipsAlsoTargeted: number;
  bothExtracted: number;
  bothProceeds: number;
}

function inspect(log: MatchLog, rules: Rules, t: Tally): void {
  const owner = new Map<ShipId, PlayerId>();
  const smugglerOn = new Map<number, Set<ShipId>>();
  const targets: { round: number; shipId: ShipId }[] = [];
  const island = log.finalState.players.find((p) => p.id === 'p1')!.island;
  for (const e of log.events) {
    if (e.type === 'ships-launched') {
      e.ships.forEach((s) => owner.set(s.id, s.owner));
    } else if (e.type === 'roles-revealed') {
      for (const d of e.deployments) {
        if (d.role === 'smuggler' && d.targetShipId !== null) {
          (smugglerOn.get(e.round) ?? smugglerOn.set(e.round, new Set()).get(e.round)!).add(d.targetShipId);
        }
        if (d.role === 'broker' && d.playerId === 'p1') {
          t.fees += roleFee(rules, island, 'broker');
          const aimed = d.targetShipId;
          if (aimed !== null) {
            t.targeted += 1;
            targets.push({ round: e.round, shipId: aimed });
            t.targetedOthers += owner.get(aimed) === 'p1' ? 0 : 1;
            if (smugglerOn.get(e.round)?.has(aimed)) {
              t.withSmuggler += 1;
            }
          }
        }
      }
    } else if (e.type === 'cash-changed' && e.playerId === 'p1' && (e.reason === 'broker-bet' || e.reason === 'broker-control')) {
      t.income += e.amount;
    } else if (e.type === 'cash-changed' && e.playerId === 'p1' && e.reason === 'broker-lift') {
      t.income += e.amount;
    }
  }
  const byShip = new Map<ShipId, { take: number; lift: number; smuggle: number; sale: number; owner: PlayerId | undefined }>();
  const row = (id: ShipId) => byShip.get(id) ?? byShip.set(id, { take: 0, lift: 0, smuggle: 0, sale: 0, owner: owner.get(id) }).get(id)!;
  for (const e of log.events) {
    if (e.type !== 'cash-changed' || e.shipId === null) {
      continue;
    }
    if (e.reason === 'broker-control') row(e.shipId).take += e.amount;
    if (e.reason === 'broker-lift') row(e.shipId).lift += e.amount;
    if (e.reason === 'smuggling') row(e.shipId).smuggle += e.amount;
    if (e.reason === 'sale') row(e.shipId).sale += e.amount;
  }
  for (const { shipId } of targets) {
    const r = row(shipId);
    if (r.owner !== 'p1') {
      t.lossOnOthers += r.take - r.lift;
    }
  }
  const targeted = new Set(targets.map((x) => x.shipId));
  for (const [round, ships] of smugglerOn) {
    void round;
    for (const id of ships) {
      t.smugglerShips += 1;
      if (targeted.has(id)) {
        t.smugglerShipsAlsoTargeted += 1;
      }
    }
  }
  for (const id of targeted) {
    const r = row(id);
    if (r.smuggle > 0 && r.take > 0) {
      t.bothExtracted += r.smuggle + r.take;
      t.bothProceeds += r.sale + r.smuggle + r.take;
    }
  }
}

console.log(`每版本 ${MATCHES} 局，p1 每次能部署都當莊家 vs 完全不部署角色（同 seed 配對）\n`);
console.log('| 版本 | 財富差 (G) | 莊家平均每局收入（毛／淨） | 被指定船主平均損失 | 指定船同時有走私商人 | 有走私商人的船被指定 |');
console.log('| --- | --- | --- | --- | --- | --- |');
for (const v of VARIANTS) {
  const rules = rulesOf(v);
  const t: Tally = { income: 0, fees: 0, targeted: 0, targetedOthers: 0, lossOnOthers: 0, withSmuggler: 0, smugglerShips: 0, smugglerShipsAlsoTargeted: 0, bothExtracted: 0, bothProceeds: 0 };
  const diffs: number[] = [];
  for (let i = 0; i < MATCHES; i += 1) {
    const withBroker = play(rules, 'broker', i);
    const without = play(rules, 'none', i);
    const wealth = (log: MatchLog) => log.result.standings.find((s) => s.playerId === 'p1')!.wealth;
    diffs.push(wealth(withBroker) - wealth(without));
    inspect(withBroker, rules, t);
  }
  const mean = diffs.reduce((a, b) => a + b, 0) / MATCHES;
  const se = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (MATCHES - 1) / MATCHES);
  const fixed = (n: number) => n.toFixed(1);
  const loss = v.targetSteps > 0 ? (t.targetedOthers === 0 ? '—' : `${fixed(t.lossOnOthers / t.targetedOthers)} G（${t.targetedOthers} 次）`) : '—（不指定船）';
  const withS = v.targetSteps > 0 ? (t.targeted === 0 ? '—' : `${((100 * t.withSmuggler) / t.targeted).toFixed(0)}%`) : '—';
  const alsoT = v.targetSteps > 0 ? `${((100 * t.smugglerShipsAlsoTargeted) / Math.max(1, t.smugglerShips)).toFixed(1)}%` : '—';
  console.log(
    `| ${v.name} | ${fixed(mean)}（±${fixed(1.96 * se)}） | ${fixed(t.income / MATCHES)} ／ ${fixed((t.income - t.fees) / MATCHES)} | ${loss} | ${withS} | ${alsoT} |`,
  );
  if (v.targetSteps > 0 && t.bothProceeds > 0) {
    console.log(`  （同船被走私＋壓價時，兩者合計抽走該船收入的 ${((100 * t.bothExtracted) / t.bothProceeds).toFixed(0)}%）`);
  }
}
