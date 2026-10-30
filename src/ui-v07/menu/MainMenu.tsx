import { Suspense, lazy, useState } from 'react';
import { SoundToggle } from '../audio/SoundToggle';
import { CinnabarChop, GameTitle } from '../skin/titleMark';
import { isLessonDone } from '../tutorial/progress';
import { markTutorialAsked, shouldAskTutorial } from '../tutorial/welcome';
import { track } from '../analytics/track';
import { WelcomePrompt } from './WelcomePrompt';
import { PrivacyNote } from '../analytics/PrivacyNote';

// The title panel over the live table: one big "back to the room" when this browser was in an
// online room, then single player, online, and the tutorial (marked as the place to start until
// its first lesson is done). The rule book is a small button in the corner.

const RulesPanel = lazy(() => import('../table3d/RulesPanel').then((m) => ({ default: m.RulesPanel })));

interface MainMenuProps {
  /** The online room this browser last sat in, if any. */
  readonly lastRoom: string | null;
  readonly onRejoin: (code: string) => void;
  readonly onLocal: () => void;
  readonly onOnline: () => void;
  readonly onTutorial: () => void;
}

export function MainMenu({ lastRoom, onRejoin, onLocal, onOnline, onTutorial }: MainMenuProps) {
  const [rules, setRules] = useState(false);
  const newcomer = !isLessonDone('basics');
  const [welcome, setWelcome] = useState(() => shouldAskTutorial(!newcomer));
  const answer = (pick: string, then?: () => void) => {
    markTutorialAsked();
    track('menu_pick', { pick });
    setWelcome(false);
    then?.();
  };
  return (
    <main className="menu-panel menu-title">
      <header className="menu-logo">
        <span className="menu-title-mark">
          <h1>
            <GameTitle />
          </h1>
          <CinnabarChop className="menu-title-chop" />
        </span>
        {/* What the game is, for someone who just arrived (the same words as the link preview's cover). */}
        <p className="menu-pitch">各懷鬼胎，讓骰子決定命運</p>
        <p>單人對電腦一局約 10 分鐘・免註冊・V0.7 試玩版</p>
      </header>
      <nav className="menu-actions" aria-label="主選單">
        {lastRoom && (
          <button type="button" className="menu-action primary rejoin" onClick={() => onRejoin(lastRoom)}>
            回到房間 <span className="menu-code">{lastRoom}</span>
          </button>
        )}
        <button type="button" className={`menu-action ${lastRoom ? '' : 'primary'}`} onClick={onLocal}>
          單機對局
          <small>對電腦、同機輪流</small>
        </button>
        <button type="button" className="menu-action" onClick={onOnline}>
          線上房間
          <small>建立房間、輸入房號</small>
        </button>
        <button type="button" className="menu-action" onClick={onTutorial}>
          新手教學
          {newcomer && <span className="menu-tag">建議先玩</span>}
        </button>
      </nav>
      <footer className="menu-corner">
        <SoundToggle className="menu-icon" />
        <button type="button" className="menu-icon" onClick={() => setRules(true)}>
          規則書
        </button>
      </footer>
      <PrivacyNote />
      {welcome && <WelcomePrompt onTutorial={() => answer('welcome-tutorial', onTutorial)} onSkip={() => answer('welcome-skip')} />}
      {rules && (
        <Suspense fallback={null}>
          <RulesPanel onClose={() => setRules(false)} where="menu" />
        </Suspense>
      )}
    </main>
  );
}
