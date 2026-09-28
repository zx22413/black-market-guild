import { useState } from 'react';
import { GameScreen } from './screens/GameScreen';
import { SetupScreen } from './screens/SetupScreen';
import { startGameSession, type GameSession } from './session/gameSession';

export function App() {
  const [session, setSession] = useState<GameSession | null>(null);
  if (!session) {
    return <SetupScreen onStart={(options) => setSession(startGameSession(options))} />;
  }
  return <GameScreen session={session} onExit={() => setSession(null)} />;
}
