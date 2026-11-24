import { useEffect } from 'react';
import { track } from '../analytics/track';

// The one-time question over the main menu for a first-time visitor: take the tutorial, or already
// know the game (tutorial/welcome.ts remembers the answer).

interface WelcomePromptProps {
  readonly onTutorial: () => void;
  readonly onSkip: () => void;
}

export function WelcomePrompt({ onTutorial, onSkip }: WelcomePromptProps) {
  // Counted apart from the answers so the stats can tell who left without choosing.
  useEffect(() => track('menu_pick', { pick: 'welcome-shown' }), []);
  return (
    <div className="menu-welcome" role="dialog" aria-modal="true" aria-labelledby="menu-welcome-title">
      <div className="menu-panel menu-welcome-card">
        <h2 id="menu-welcome-title">第一次遊玩嗎？</h2>
        <p>先玩一下新手教學？幾分鐘就能學會基本玩法。</p>
        <div className="menu-actions">
          <button type="button" className="menu-action primary" onClick={onTutorial}>
            進入新手教學
          </button>
          <button type="button" className="menu-action" onClick={onSkip}>
            我會玩了
          </button>
        </div>
      </div>
    </div>
  );
}
