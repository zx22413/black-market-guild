import { useCallback, useState } from 'react';
import { isRoomCode } from '../v07/online';
import { TUTORIALS, tutorialById, type TutorialId } from '../v07/tutorial';
import { LocalSetup } from './menu/LocalSetup';
import { MainMenu } from './menu/MainMenu';
import { MenuBackdrop } from './menu/MenuBackdrop';
import './menu/menu.css';
import { lastRoom } from './online/onlineClient';
import { OnlineScreen } from './online/OnlineScreen';
import { startGameSession, type GameSession, type SessionOptions } from './session/gameSession';
import { MatchView } from './table/MatchView';
import { TutorialMenu } from './tutorial/TutorialMenu';
import { TutorialScreen } from './tutorial/TutorialScreen';

/** A `?room=CODE` link opens that online room directly. */
function roomFromUrl(): string | null {
  const code = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? null;
  return isRoomCode(code) ? code : null;
}

type Mode =
  | { readonly kind: 'menu' }
  | { readonly kind: 'local-setup' }
  /** `options` again with a new seed is the result card's "play again". */
  | { readonly kind: 'local'; readonly session: GameSession; readonly options: SessionOptions }
  | { readonly kind: 'online'; readonly room: string | null }
  | { readonly kind: 'tutorial-menu' }
  /** `run` changes to replay the same lesson from the start. */
  | { readonly kind: 'tutorial'; readonly id: TutorialId; readonly run: number };

/** The lesson after `id` in menu order, if any. */
const nextLesson = (id: TutorialId) => TUTORIALS[TUTORIALS.findIndex((t) => t.id === id) + 1] ?? null;

const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;

/** Screens drawn over the main menu's live table; the match screens bring their own table. */
const OVER_MENU: ReadonlySet<Mode['kind']> = new Set(['menu', 'local-setup', 'online', 'tutorial-menu']);

export function App() {
  const [mode, setMode] = useState<Mode>(() => {
    const room = roomFromUrl();
    return room ? { kind: 'online', room } : { kind: 'menu' };
  });
  // An online match takes the whole screen; the menu's table stops so two 3D scenes never run.
  const [onlineMatch, setOnlineMatch] = useState(false);
  const onInMatch = useCallback((inMatch: boolean) => setOnlineMatch(inMatch), []);
  const home = () => setMode({ kind: 'menu' });
  const startLocal = (options: SessionOptions) => setMode({ kind: 'local', session: startGameSession(options), options });
  const backdrop = OVER_MENU.has(mode.kind) && !(mode.kind === 'online' && onlineMatch);

  return (
    <>
      {backdrop && <MenuBackdrop />}
      <Screen mode={mode} setMode={setMode} home={home} startLocal={startLocal} onInMatch={onInMatch} />
    </>
  );
}

interface ScreenProps {
  readonly mode: Mode;
  readonly setMode: (mode: Mode) => void;
  readonly home: () => void;
  readonly startLocal: (options: SessionOptions) => void;
  readonly onInMatch: (inMatch: boolean) => void;
}

function Screen({ mode, setMode, home, startLocal, onInMatch }: ScreenProps) {
  switch (mode.kind) {
    case 'menu':
      return (
        <MainMenu
          lastRoom={lastRoom()}
          onRejoin={(room) => setMode({ kind: 'online', room })}
          onLocal={() => setMode({ kind: 'local-setup' })}
          onOnline={() => setMode({ kind: 'online', room: null })}
          onTutorial={() => setMode({ kind: 'tutorial-menu' })}
        />
      );
    case 'local-setup':
      return <LocalSetup onStart={startLocal} onBack={home} />;
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
      return <OnlineScreen initialRoom={mode.room} onExit={home} onInMatch={onInMatch} />;
    case 'local': {
      const { options } = mode;
      return (
        <MatchView
          key={options.seed}
          session={mode.session}
          onExit={home}
          rematch={{ kind: 'now', onRematch: () => startLocal({ ...options, seed: randomSeed() }) }}
        />
      );
    }
  }
}
