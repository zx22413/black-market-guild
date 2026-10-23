import { useMemo } from 'react';
import { RULES_V07, type MatchEvent, type PlayerId } from '../../v07/game';
import { runMatchSync, setupFromSeats, type SeatConfig } from '../../v07/match';
import { ReceiptCard } from '../beats/ReceiptCard';
import { buildReceipt } from '../beats/shipBeat';
import { MarketCard } from '../table3d/MarketCard';
import { ResultCard } from '../table3d/ResultCard';
import { resultRows } from '../table3d/resultModel';
import { marketRows } from '../table3d/settlementModel';

// The real panels of a seeded all-bot match for the skin lab (dev/SkinLabPreview.tsx): the market
// card, the bill and the result, so their frames can be checked without playing to them on the 3D
// table. In the lab their backdrops sit in the cell instead of covering the screen (skinLab.css).

const SEATS: SeatConfig[] = [
  { kind: 'bot', name: '你', strategy: 'aggressive' },
  { kind: 'bot', name: '黑潮會', strategy: 'aggressive' },
  { kind: 'bot', name: '金錨公會', strategy: 'balanced' },
  { kind: 'bot', name: '霧港商團', strategy: 'builder' },
];
const SEED = 7;
const ROUND = 1;
const VIEWER: PlayerId = 'p1';
const COLORS = ['#e0a63c', '#c0392b', '#3b6fb6', '#5b9c5b'] as const;

function demandOf(events: readonly MatchEvent[], round: number) {
  const d = events.find((e): e is Extract<MatchEvent, { type: 'demand-revealed' }> => e.type === 'demand-revealed' && e.round === round);
  return d?.demand ?? { wood: 0, iron: 0, spice: 0, arms: 0 };
}

function useLabMatch() {
  return useMemo(() => {
    const setup = setupFromSeats({ seed: SEED, seats: SEATS });
    const log = runMatchSync(setup, setup.bots);
    const ids = setup.players.map((p) => p.id);
    return {
      events: log.events,
      market: marketRows(log.events, ROUND, demandOf(log.events, ROUND)),
      receipt: buildReceipt(log.events, ROUND, VIEWER),
      result: resultRows(log.events, log.result, RULES_V07.startingCash, RULES_V07),
      nameOf: (id: PlayerId) => setup.players.find((p) => p.id === id)?.name ?? id,
      colorOf: (id: PlayerId) => COLORS[ids.indexOf(id)] ?? '#999',
    };
  }, []);
}

/** The market card, the bill and the result of round 1 / the end of a seeded match. */
export function PanelsApplied() {
  const m = useLabMatch();
  return (
    <div className="lab-panels">
      <MarketCard rows={m.market} shown={m.market.length} />
      <div className="lab-overlay">
        <ReceiptCard round={ROUND} viewer={VIEWER} lines={m.receipt.lines} net={m.receipt.net} />
      </div>
      <div className="lab-overlay wide">
        <ResultCard rows={m.result} nameOf={m.nameOf} colorOf={m.colorOf} viewer={VIEWER} rounds={RULES_V07.rounds} onRestart={() => undefined} />
      </div>
    </div>
  );
}
