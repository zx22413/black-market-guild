/**
 * Plays one match with random legal choices and prints a readable log.
 * Usage: npm run match:log -- [seed] [playerCount]
 */
import {
  applyAction,
  createMatch,
  createRng,
  getLegalActions,
  getPendingDecisions,
  type MatchEvent,
  type MatchState,
} from '../src/game';
import {
  CASH_REASON_LABELS,
  MARKET_EVENT_LABELS,
  VOYAGE_EVENT_LABELS,
} from '../src/ui/labels';

const NAMES = ['Alice', 'Bob', 'Carol', 'Dave'];

function parseArgs(): { seed: number; playerCount: number } {
  const argv = (globalThis as { process?: { argv?: string[] } }).process?.argv ?? [];
  const seed = Number.parseInt(argv[2] ?? '42', 10);
  const playerCount = Number.parseInt(argv[3] ?? '4', 10);
  if (!Number.isInteger(seed) || !Number.isInteger(playerCount)) {
    throw new Error('usage: npm run match:log -- [seed] [playerCount]');
  }
  return { seed, playerCount };
}

function playRandomly(initial: MatchState, seed: number): MatchEvent[] {
  const policy = createRng(seed + 1);
  let state = initial;
  const events: MatchEvent[] = [];
  while (state.phase !== 'game-over') {
    const decision = getPendingDecisions(state)[0];
    if (decision === undefined) {
      throw new Error(`no pending decision in phase ${state.phase}`);
    }
    const legal = getLegalActions(state, decision.playerId);
    const action = legal[policy.int(0, legal.length - 1)];
    if (action === undefined) {
      throw new Error(`no legal action for ${decision.playerId}`);
    }
    const result = applyAction(state, action);
    if (!result.ok) {
      throw new Error(`${result.error.code}: ${result.error.message}`);
    }
    state = result.value.state;
    events.push(...result.value.events);
  }
  return events;
}

function formatLog(
  events: readonly MatchEvent[],
  names: ReadonlyMap<string, string>,
  startingCash: number,
): string[] {
  const name = (id: string) => names.get(id) ?? id;
  const cash = new Map([...names.keys()].map((id) => [id, startingCash]));
  const shipOwners = new Map<string, string>();
  const lines: string[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'round-started':
        lines.push('', `── 第 ${event.round} 回合 ──`);
        break;
      case 'market-event-revealed':
        lines.push(`  市場事件：${MARKET_EVENT_LABELS[event.event]}`);
        break;
      case 'recruitments-announced':
        lines.push(`  發起合資招募：${event.recruiters.length > 0 ? event.recruiters.map(name).join('、') : '無'}`);
        break;
      case 'applications-announced': {
        const list = event.applications.map((a) => `${name(a.applicantId)} → ${name(a.recruiterId)}`);
        lines.push(`  應徵：${list.length > 0 ? list.join('、') : '無'}`);
        break;
      }
      case 'joint-ventures-formed': {
        const list = event.ventures.map((v) => `${name(v.recruiterId)} 挑選 ${name(v.applicantId)}`);
        lines.push(`  合資成立：${list.length > 0 ? list.join('、') : '無'}`);
        break;
      }
      case 'ships-launched': {
        event.ships.forEach((s) => shipOwners.set(s.id, s.owners.map(name).join('＋')));
        const ships = event.ships.map((s) => `${s.id}（${shipOwners.get(s.id)}）`);
        lines.push(`  出航：${ships.length > 0 ? ships.join('、') : '無'}`);
        lines.push(`  留港：${event.stayedInPort.length > 0 ? event.stayedInPort.map(name).join('、') : '無'}`);
        break;
      }
      case 'cash-changed': {
        cash.set(event.playerId, (cash.get(event.playerId) ?? 0) + event.amount);
        const verb = event.amount >= 0 ? '獲得' : '支付';
        lines.push(`  ${name(event.playerId)} ${verb} ${Math.abs(event.amount)} G（${CASH_REASON_LABELS[event.reason]}）`);
        break;
      }
      case 'voyage-event-revealed':
        lines.push(`  航海事件：${VOYAGE_EVENT_LABELS[event.event]}`);
        break;
      case 'ship-resolved':
        lines.push(`  ${event.shipId}（${shipOwners.get(event.shipId)}）${event.outcome === 'arrived' ? '成功抵達' : '沉沒'}`);
        break;
      case 'round-ended':
        lines.push(`  回合結束現金：${[...names.keys()].map((id) => `${name(id)} ${cash.get(id)}`).join('、')}`);
        break;
      case 'match-ended':
        lines.push('', '══ 最終結果 ══');
        for (const s of event.result.standings) {
          lines.push(`  第 ${s.rank} 名 ${name(s.playerId)}：財富 ${s.wealth}（現金 ${s.cash}＋資產 ${s.assetValue}）`);
        }
        break;
      case 'phase-started':
        break;
      default: {
        const unhandled: never = event;
        throw new Error(`unhandled event: ${JSON.stringify(unhandled)}`);
      }
    }
  }
  return lines;
}

function main(): void {
  const { seed, playerCount } = parseArgs();
  const players = NAMES.slice(0, playerCount).map((n, i) => ({ id: `p${i + 1}`, name: n }));
  const created = createMatch({ seed, players });
  if (!created.ok) {
    throw new Error(`${created.error.code}: ${created.error.message}`);
  }
  const events = [...created.value.events, ...playRandomly(created.value.state, seed)];
  const names = new Map(players.map((p) => [p.id, p.name]));
  const header = [
    `黑市商會 對局紀錄（seed ${seed}，${playerCount} 人，所有決定隨機選擇）`,
    '目前進度：獨資、合資與航運收入已生效；角色、資產與事件效果尚未實作。',
  ];
  const lines = formatLog(events, names, created.value.state.rules.startingCash);
  console.log([...header, ...lines].join('\n'));
}

main();
