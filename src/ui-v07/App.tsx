import { useState } from 'react';
import { isRoomCode } from '../v07/online';
import { OnlineScreen } from './online/OnlineScreen';
import { SetupScreen } from './screens/SetupScreen';
import { startGameSession, type GameSession } from './session/gameSession';
import { MatchView } from './table/MatchView';

/** A `?room=CODE` link opens that online room directly. */
function roomFromUrl(): string | null {
  const code = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? null;
  return isRoomCode(code) ? code : null;
}

type Mode = { readonly kind: 'setup' } | { readonly kind: 'local'; readonly session: GameSession } | { readonly kind: 'online'; readonly room: string | null };

export function App() {
  const [mode, setMode] = useState<Mode>(() => {
    const room = roomFromUrl();
    return room ? { kind: 'online', room } : { kind: 'setup' };
  });
  const home = () => setMode({ kind: 'setup' });

  switch (mode.kind) {
    case 'setup':
      return <SetupScreen onStart={(options) => setMode({ kind: 'local', session: startGameSession(options) })} onOnline={() => setMode({ kind: 'online', room: null })} />;
    case 'online':
      return <OnlineScreen initialRoom={mode.room} onExit={home} />;
    case 'local':
      return <MatchView session={mode.session} onExit={home} />;
  }
}
