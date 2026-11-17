import { useState } from 'react';
import '../beats/beat.css';
import '../table3d/islandCard.css';
import '../skin/layers.css';
import { RULES_V08_PROTO, type MatchEvent, type TideKind } from '../../v07/game';
import { TideChip } from '../table3d/TideChip';
import { roundCards } from '../table3d/roundCard';
import { RoundCardShow } from '../table3d/RoundCardShow';
import { RulesContext } from '../table3d/rulesContext';
import { tideStatus } from '../table3d/tideModel';
import { VoyageEventChip } from '../table3d/VoyageEventCard';

// Dev-only: the V0.8 prototype's round cards (an experiment, not rules) over a plain sea, at /v07.html?dev=roundcards.
// &tide=storm|pirate|inspection|crash picks the tide (default crash). The buttons play 暗潮將至, the tide's boss side,
// 最後的大市集 and a plain last round; the corner shows the tide chip and the boss chip as in the game.

const DEMAND = { wood: 1, iron: 1, spice: 1, arms: 1 };
const FLIP = { storm: 'storm', pirate: 'sea-fog', inspection: 'black-market-rush', crash: 'calm-seas' } as const;

export function RoundCardsPreview() {
  const tide = (new URLSearchParams(window.location.search).get('tide') ?? 'crash') as TideKind;
  const other: TideKind = tide === 'storm' ? 'pirate' : 'storm';
  const events: MatchEvent[] = [
    { type: 'tide-candidates', candidates: [other, tide] },
    { type: 'dark-tide-rising', round: 4 },
    { type: 'tide-revealed', round: 4, tide },
    { type: 'voyage-event-revealed', round: 5, event: FLIP[tide] },
    { type: 'boss-event', round: 5, event: FLIP[tide] },
    { type: 'final-round', round: 7, effect: 'final-market', demand: DEMAND },
    { type: 'voyage-event-revealed', round: 10, event: 'tailwind' },
    { type: 'final-round', round: 10, effect: null, demand: DEMAND },
  ];
  const [round, setRound] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const at = round ?? 1;
  const boss = roundCards(events, at, RULES_V08_PROTO).find((c) => c.kind === 'voyage' && c.boss);
  return (
    <RulesContext.Provider value={RULES_V08_PROTO}>
      <div className="t3-screen" style={{ position: 'fixed', inset: 0, background: '#2f8f9d' }}>
        <div style={{ position: 'absolute', zIndex: 60, bottom: 12, left: 12, display: 'flex', gap: 6 }}>
          {([['暗潮將至', 4], ['暗潮面', 5], ['最後的大市集', 7], ['回合上限', 10]] as const).map(([label, r]) => (
            <button key={r} type="button" onClick={() => { setRound(r); setRun((n) => n + 1); }}>
              {label}
            </button>
          ))}
        </div>
        {boss?.kind === 'voyage' && <VoyageEventChip event={boss.event} boss={{ title: boss.title, text: boss.lines.join('') }} />}
        <TideChip status={tideStatus(events.filter((e) => !('round' in e) || e.round <= at))} round={at} />
        {at > 4 && <div className="tide-season" aria-hidden="true" />}
        {round !== null && <RoundCardShow key={run} cards={roundCards(events, round, RULES_V08_PROTO)} onDone={() => setRun((n) => n)} />}
      </div>
    </RulesContext.Provider>
  );
}
