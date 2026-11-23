import { useState } from 'react';
import '../beats/beat.css';
import '../table3d/islandCard.css';
import '../skin/layers.css';
import '../skin/v08.css';
import { RULES_V08, type MatchEvent, type TideKind } from '../../v07/game';
import { TideChip } from '../table3d/TideChip';
import { roundCards } from '../table3d/roundCard';
import { RoundCardShow } from '../table3d/RoundCardShow';
import { RulesContext } from '../table3d/rulesContext';
import { TIDE_LABELS, tideStatus } from '../table3d/tideModel';
import { TideIcon } from '../table3d/tideIcons';
import { FACILITY_LABELS } from '../table/v08Text';
import { VoyageEventChip } from '../table3d/VoyageEventCard';

// Dev-only: the V0.8 prototype's round cards (an experiment, not rules) over a plain sea, at /v07.html?dev=roundcards.
// &tide=storm|pirate|inspection|crash picks the tide (default crash). The buttons play 暗潮將至, the tide's boss side,
// 最後的大市集 and a plain last round; the corner shows the tide chip and the boss chip as in the game.

const DEMAND = { wood: 1, iron: 1, spice: 1, arms: 1 };
const SHIELD_BUILDING = { storm: 'repairyard', pirate: 'armory', inspection: 'armory', crash: 'tradehouse' } as const;
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
    { type: 'final-round', round: 8, effect: 'open-market', demand: DEMAND },
    { type: 'final-round', round: 9, effect: 'last-gamble', demand: DEMAND },
    { type: 'voyage-event-revealed', round: 10, event: 'tailwind' },
    { type: 'final-round', round: 10, effect: null, demand: DEMAND },
  ];
  const [round, setRound] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const at = round ?? 1;
  const boss = roundCards(events, at, RULES_V08).find((c) => c.kind === 'voyage' && c.boss);
  return (
    <RulesContext.Provider value={RULES_V08}>
      <div className="t3-screen" style={{ position: 'fixed', inset: 0, background: '#2f8f9d' }}>
        <div style={{ position: 'absolute', zIndex: 60, bottom: 12, left: 12, display: 'flex', gap: 6 }}>
          {([['暗潮將至', 4], ['暗潮面', 5], ['最後的大市集', 7], ['黑市大開', 8], ['最後一搏', 9], ['回合上限', 10]] as const).map(([label, r]) => (
            <button key={r} type="button" onClick={() => { setRound(r); setRun((n) => n + 1); }}>
              {label}
            </button>
          ))}
        </div>
        {/* A building turning the tide away, as the resolution says it over the island. */}
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)' }}>
          <span className="isle-moment gain">
            <span key={run} className="isle-chip gain tide-shield">
              <span className="tide-shield-mark">
                <TideIcon kind={tide} wave={false} />
              </span>
              {FACILITY_LABELS[SHIELD_BUILDING[tide]]}：擋下{TIDE_LABELS[tide]}
            </span>
          </span>
        </div>
        {boss?.kind === 'voyage' && <VoyageEventChip event={boss.event} boss={{ title: boss.title, text: boss.lines.join('') }} />}
        <TideChip status={tideStatus(events.filter((e) => !('round' in e) || e.round <= at))} round={at} />
        {at > 4 && <div className="tide-season" aria-hidden="true" />}
        {round !== null && <RoundCardShow key={run} cards={roundCards(events, round, RULES_V08)} onDone={() => setRun((n) => n)} />}
      </div>
    </RulesContext.Provider>
  );
}
