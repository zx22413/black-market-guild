import { useMemo, useState, useSyncExternalStore } from 'react';
import { RULES_BUILDINGS, RULES_V08 } from '../../v07/game';
import type { SeatConfig } from '../../v07/match';
import { startGameSession } from '../session/gameSession';
import { Table3DScreen } from '../table3d/Table3DScreen';

// Dev-only: a quick 3D match at /v07.html?dev=round3d (also ?dev=invest3d), &seed=3: you against
// three bots on the same screen the app uses (src/ui-v07/table3d/Table3DScreen.tsx). &autoplay
// answers your decisions with the first legal action and skips the shows (to reach the end fast). &buildings=1 plays the
// old rules with the four buildings (RULES_BUILDINGS); without it you play the ship bays (you pick a ship type before loading it).
// &autoplay&until=4 stops the autoplay when round 4 begins (to look at a late round without playing the early ones).
// &v08 plays the V0.8 prototype (RULES_V08; an experiment, not rules).

const SEATS: SeatConfig[] = [
  { kind: 'local-human', name: '你' },
  { kind: 'bot', name: '黑潮會', strategy: 'aggressive' },
  { kind: 'bot', name: '金錨公會', strategy: 'balanced' },
  { kind: 'bot', name: '霧港商團', strategy: 'builder' },
];

export function Round3DPreview() {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') ?? 3) || 3;
  const until = Number(params.get('until')) || null;
  const buildings = params.has('buildings');
  const rules = params.has('v08') ? RULES_V08 : buildings ? RULES_BUILDINGS : null;
  const [run, setRun] = useState(0);
  const session = useMemo(() => startGameSession({ seed: seed + run, seats: SEATS, ...(rules ? { rules } : {}) }), [seed, run, rules]);
  // The round in play: the last round a phase began in.
  const round = useSyncExternalStore(session.subscribe, () => session.getSnapshot().events.reduce((r, e) => (e.type === 'phase-started' ? Math.max(r, e.round) : r), 0));
  const autoplay = params.has('autoplay') && (until === null || round < until);
  // The result card's buttons as the single-player app shows them (「邀請朋友一起玩」 only logs here).
  const rematch = { kind: 'now', onRematch: () => setRun((n) => n + 1), onInvite: () => console.info('invite a friend') } as const;
  return <Table3DScreen key={run} session={session} autoplay={autoplay} rematch={rematch} onExit={() => setRun((n) => n + 1)} />;
}
