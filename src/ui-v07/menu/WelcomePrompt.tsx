// The one-time question over the main menu for a first-time visitor: take the tutorial, or already
// know the game (tutorial/welcome.ts remembers the answer).

interface WelcomePromptProps {
  readonly onTutorial: () => void;
  readonly onSkip: () => void;
}

export function WelcomePrompt({ onTutorial, onSkip }: WelcomePromptProps) {
  return (
    <div className="menu-welcome" role="dialog" aria-modal="true" aria-labelledby="menu-welcome-title">
      <div className="menu-panel menu-welcome-card">
        <h2 id="menu-welcome-title">第一次遊玩嗎？</h2>
        <p>要不要先進入新手教學關卡？跟著引導玩幾分鐘，就能學會基本規則。</p>
        <div className="menu-actions">
          <button type="button" className="menu-action primary" onClick={onTutorial}>
            進入新手教學
          </button>
          <button type="button" className="menu-action" onClick={onSkip}>
            我已經熟練
          </button>
        </div>
      </div>
    </div>
  );
}
