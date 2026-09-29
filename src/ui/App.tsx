import { lazy, Suspense, useState } from 'react';
import { SetupScreen } from './screens/SetupScreen';
import { startGameSession, type GameSession } from './session/gameSession';

// The 3D table pulls in three.js; load it only once a match starts.
const TableScreen = lazy(() => import('./table/TableScreen').then((m) => ({ default: m.TableScreen })));

export function App() {
  const [session, setSession] = useState<GameSession | null>(null);
  if (!session) {
    return <SetupScreen onStart={(options) => setSession(startGameSession(options))} />;
  }
  return (
    <Suspense fallback={<div className="scene-boot">整理港口中…</div>}>
      <TableScreen session={session} onExit={() => setSession(null)} />
    </Suspense>
  );
}
