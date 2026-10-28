import { useCallback, useEffect, useRef, useState } from 'react';
import { track, trackErrors, trackVisit } from './analytics/track';
import { isRoomCode } from '../v07/online';
import { useSoundtrack } from './audio/useSoundtrack';
import { useUiClicks } from './audio/useUiSounds';
import { TUTORIALS, tutorialById, type TutorialId } from '../v07/tutorial';
import { launchMs } from './menu/launch';
import { LocalSetup } from './menu/LocalSetup';
import { MainMenu } from './menu/MainMenu';
import { MenuBackdrop } from './menu/MenuBackdrop';
import { StartGate } from './menu/StartGate';
import type { MenuView } from './menu/menuSeats';
import './menu/menu.css';
import './skin/layers.css';
import './skin/menu.css';
import { lastRoom } from './online/onlineClient';
import { OnlineScreen } from './online/OnlineScreen';
import { startGameSession, type GameSession, type SessionOptions } from './session/gameSession';
import { MatchView } from './table/MatchView';
import { watchMenuPanels } from './menu/scrollHint';
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
  /** The ships sail out on the menu table before the match screen takes over. */
  | { readonly kind: 'launching'; readonly options: SessionOptions }
  /** `options` again with a new seed is the result card's "play again". */
  | { readonly kind: 'local'; readonly session: GameSession; readonly options: SessionOptions }
  /** `create` opens a new room at once (the single-player result card's 「邀請朋友一起玩」). */
  | { readonly kind: 'online'; readonly room: string | null; readonly create?: boolean }
  | { readonly kind: 'tutorial-menu' }
  /** `run` changes to replay the same lesson from the start. */
  | { readonly kind: 'tutorial'; readonly id: TutorialId; readonly run: number };

/** The lesson after `id` in menu order, if any. */
const nextLesson = (id: TutorialId) => TUTORIALS[TUTORIALS.findIndex((t) => t.id === id) + 1] ?? null;

const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;

/**
 * What the menu table shows behind each screen; null where a match screen brings its own table
 * (two 3D scenes never run at once). The online pages say for themselves (`onlineView`).
 */
function menuViewOf(mode: Mode, onlineView: MenuView | null): MenuView | null {
  switch (mode.kind) {
    case 'menu':
      return { stage: 'title' };
    case 'local-setup':
      return { stage: 'local' };
    case 'tutorial-menu':
      return { stage: 'tutorial' };
    case 'launching':
      return { stage: 'launch', seatCount: mode.options.seats.length };
    case 'online':
      return onlineView;
    case 'local':
    case 'tutorial':
      return null;
  }
}

export function App() {
  const [mode, setMode] = useState<Mode>(() => {
    const room = roomFromUrl();
    return room ? { kind: 'online', room } : { kind: 'menu' };
  });
  // Dev preview links (`?dev=…`) skip the cover.
  const [started, setStarted] = useState(() => new URLSearchParams(location.search).has('dev'));
  const [onlineView, setOnlineView] = useState<MenuView | null>({ stage: 'online' });
  const onView = useCallback((view: MenuView | null) => setOnlineView(view), []);
  const home = () => {
    setOnlineView({ stage: 'online' });
    setMode({ kind: 'menu' });
  };
  const startLocal = (options: SessionOptions) => setMode({ kind: 'local', session: startGameSession(options), options });
  const launchLocal = (options: SessionOptions) => (launchMs() > 0 ? setMode({ kind: 'launching', options }) : startLocal(options));

  // A menu panel that has to scroll says so (a fade and a chevron at its foot).
  useEffect(() => watchMenuPanels(), []);

  // Anonymous statistics: one visit per tab, and uncaught errors with the screen they happened on.
  const screen = useRef(mode.kind);
  screen.current = mode.kind;
  useEffect(() => {
    trackVisit();
    trackErrors(() => screen.current);
  }, []);

  useEffect(() => {
    if (mode.kind !== 'launching') return;
    const timer = setTimeout(() => startLocal(mode.options), launchMs());
    return () => clearTimeout(timer);
  }, [mode]);

  const view = menuViewOf(mode, onlineView);
  // The menu table means the cover track; a match screen brings the in-game track and the sea.
  useSoundtrack(view);
  useUiClicks();
  return (
    <>
      {view && <MenuBackdrop view={view} />}
      {!started && <StartGate onStart={() => setStarted(true)} />}
      {started && <Screen mode={mode} setMode={setMode} home={home} launchLocal={launchLocal} startLocal={startLocal} onView={onView} />}
    </>
  );
}

interface ScreenProps {
  readonly mode: Mode;
  readonly setMode: (mode: Mode) => void;
  readonly home: () => void;
  readonly launchLocal: (options: SessionOptions) => void;
  readonly startLocal: (options: SessionOptions) => void;
  readonly onView: (view: MenuView | null) => void;
}

function Screen({ mode, setMode, home, launchLocal, startLocal, onView }: ScreenProps) {
  switch (mode.kind) {
    case 'menu':
      return (
        <MainMenu
          lastRoom={lastRoom()}
          onRejoin={(room) => {
            track('menu_pick', { pick: 'rejoin' });
            setMode({ kind: 'online', room });
          }}
          onLocal={() => {
            track('menu_pick', { pick: 'local' });
            setMode({ kind: 'local-setup' });
          }}
          onOnline={() => {
            track('menu_pick', { pick: 'online' });
            setMode({ kind: 'online', room: null });
          }}
          onTutorial={() => {
            track('menu_pick', { pick: 'tutorial' });
            setMode({ kind: 'tutorial-menu' });
          }}
        />
      );
    case 'local-setup':
      return <LocalSetup onStart={launchLocal} onBack={home} />;
    case 'launching':
      return null;
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
      return <OnlineScreen initialRoom={mode.room} autoCreate={mode.create === true} onExit={home} onView={onView} />;
    case 'local': {
      const { options } = mode;
      return (
        <MatchView
          key={options.seed}
          session={mode.session}
          onExit={home}
          rematch={{
            kind: 'now',
            onRematch: () => startLocal({ ...options, seed: randomSeed() }),
            onInvite: () => {
              track('menu_pick', { pick: 'invite-after-match' });
              setMode({ kind: 'online', room: null, create: true });
            },
          }}
        />
      );
    }
  }
}
