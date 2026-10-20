import { useState } from 'react';
import { isRoomCode } from '../v07/online';
import { TUTORIALS, tutorialById, type TutorialId } from '../v07/tutorial';
import { OnlineScreen } from './online/OnlineScreen';
import { SetupScreen } from './screens/SetupScreen';
import { startGameSession, type GameSession } from './session/gameSession';
import { MatchView } from './table/MatchView';
import { TutorialMenu } from './tutorial/TutorialMenu';
import { TutorialScreen } from './tutorial/TutorialScreen';

/** A `?room=CODE` link opens that online room directly. */
function roomFromUrl(): string | null {
  const code = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? null;
  return isRoomCode(code) ? code : null;
}

type Mode =
  | { readonly kind: 'setup' }
  | { readonly kind: 'local'; readonly session: GameSession }
  | { readonly kind: 'online'; readonly room: string | null }
  | { readonly kind: 'tutorial-menu' }
  /** `run` changes to replay the same lesson from the start. */
  | { readonly kind: 'tutorial'; readonly id: TutorialId; readonly run: number };

/** The lesson after `id` in menu order, if any. */
const nextLesson = (id: TutorialId) => TUTORIALS[TUTORIALS.findIndex((t) => t.id === id) + 1] ?? null;

export function App() {
  const [mode, setMode] = useState<Mode>(() => {
    const room = roomFromUrl();
    return room ? { kind: 'online', room } : { kind: 'setup' };
  });
  const home = () => setMode({ kind: 'setup' });

  switch (mode.kind) {
    case 'setup':
      return (
        <SetupScreen
          onStart={(options) => setMode({ kind: 'local', session: startGameSession(options) })}
          onOnline={() => setMode({ kind: 'online', room: null })}
          onTutorial={() => setMode({ kind: 'tutorial-menu' })}
        />
      );
    case 'tutorial-menu':
      return <TutorialMenu onStart={(id) => setMode({ kind: 'tutorial', id, run: 0 })} onBack={home} />;
    case 'tutorial': {
      const next = nextLesson(mode.id);
      const { id, run } = mode;
      return (
        <TutorialScreen
          key={`${id}-${run}`}
          script={tutorialById(id)}
          next={next}
          onReplay={() => setMode({ kind: 'tutorial', id, run: run + 1 })}
          onNext={() => next && setMode({ kind: 'tutorial', id: next.id, run: 0 })}
          onExit={() => setMode({ kind: 'tutorial-menu' })}
        />
      );
    }
    case 'online':
      return <OnlineScreen initialRoom={mode.room} onExit={home} />;
    case 'local':
      return <MatchView session={mode.session} onExit={home} />;
  }
}
