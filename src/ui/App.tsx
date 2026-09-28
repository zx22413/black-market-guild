import { lazy, Suspense, useState } from 'react';
import { GameScreen } from './screens/GameScreen';
import { SetupScreen } from './screens/SetupScreen';
import { startGameSession, type GameSession } from './session/gameSession';

const ScenePrototype = lazy(() => import('./scene/ScenePrototype').then((m) => ({ default: m.ScenePrototype })));

export function App() {
  const [session, setSession] = useState<GameSession | null>(null);
  // Static 3D table mock-up for composition review: open /#scene.
  if (window.location.hash === '#scene') {
    return (
      <Suspense fallback={null}>
        <ScenePrototype />
      </Suspense>
    );
  }
  if (!session) {
    return <SetupScreen onStart={(options) => setSession(startGameSession(options))} />;
  }
  return <GameScreen session={session} onExit={() => setSession(null)} />;
}
