import type { MatchEvent } from '../game';
import {
  ASSET_LABELS,
  CASH_REASON_LABELS,
  MARKET_EVENT_LABELS,
  ROLE_LABELS,
  VOYAGE_EVENT_LABELS,
} from './labels';

/**
 * Turns public events into readable Traditional Chinese log lines. Shared by the
 * match log script and the in-game log; uses public information only.
 */
export function formatLog(
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
      case 'assets-purchased': {
        const list = event.purchases.map((p) => `${name(p.playerId)} 購買${ASSET_LABELS[p.asset]}`);
        if (list.length > 0) {
          lines.push(`  資產：${list.join('、')}`);
        }
        break;
      }
      case 'recruitments-announced':
        lines.push(`  發起合資招募：${event.recruiters.length > 0 ? event.recruiters.map(name).join('、') : '無'}`);
        break;
      case 'recruitments-withdrawn':
        lines.push(`  撤回招募（改去應徵）：${event.recruiters.map(name).join('、')}`);
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
      case 'roles-revealed': {
        const list = event.deployments.map(
          (d) => `${name(d.playerId)} → ${d.targetShipId}（${shipOwners.get(d.targetShipId)}）`,
        );
        lines.push(`  揭露${ROLE_LABELS[event.role]}：${list.length > 0 ? list.join('、') : '無'}`);
        if (event.rerolledShipIds.length > 0) {
          lines.push(`    重擲的船：${event.rerolledShipIds.join('、')}`);
        }
        break;
      }
      case 'ship-smuggled':
        lines.push(`  ${event.shipId}（${shipOwners.get(event.shipId)}）被人走私 ${event.amount} G（走私者身分不明）`);
        break;
      case 'smugglers-caught':
        lines.push(`  ${event.shipId} 查獲走私：${event.smugglers.map(name).join('、')}`);
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
