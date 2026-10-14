import { useMemo, useState } from 'react';
import type { SeatConfig } from '../../v07/match';
import { startGameSession } from '../session/gameSession';
import { Table3DScreen } from '../table3d/Table3DScreen';

// Dev-only: a quick 3D match at /v07.html?dev=round3d (also ?dev=invest3d), &seed=3: you against
// three bots on the same screen the app uses (src/ui-v07/table3d/Table3DScreen.tsx). &autoplay
// answers your decisions with the first legal action and skips the shows (to reach the end fast).

const SEATS: SeatConfig[] = [
  { kind: 'local-human', name: '你' },
  { kind: 'bot', name: '黑潮會', strategy: 'aggressive' },
  { kind: 'bot', name: '金錨公會', strategy: 'balanced' },
  { kind: 'bot', name: '霧港商團', strategy: 'builder' },
];

export function Round3DPreview() {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') ?? 3) || 3;
  const autoplay = params.has('autoplay');
  const [run, setRun] = useState(0);
  const session = useMemo(() => startGameSession({ seed: seed + run, seats: SEATS }), [seed, run]);
  return <Table3DScreen key={run} session={session} autoplay={autoplay} onExit={() => setRun((n) => n + 1)} />;
}
