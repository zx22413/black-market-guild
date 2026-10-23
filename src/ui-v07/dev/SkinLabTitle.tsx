import { MainMenu } from '../menu/MainMenu';
import { CinnabarChop, GameTitle } from '../skin/titleMark';

/**
 * Skin lab row for the game's name (H3-A, applied): the real main menu, and the English-led version
 * of the stencilled title on the same paper. The game has no English UI yet, so only the lab shows it.
 */

const noop = () => undefined;

export function TitleApplied() {
  return (
    <div className="lab-panels">
      <div className="lab-menu">
        <MainMenu lastRoom={null} onRejoin={noop} onLocal={noop} onOnline={noop} onTutorial={noop} />
      </div>
      <div className="lab-menu">
        <div className="menu-panel">
          <header className="menu-logo">
            <span className="menu-title-mark">
              <h1>
                <GameTitle lang="en" />
              </h1>
              <CinnabarChop className="menu-title-chop" />
            </span>
            <p>English title (no English UI yet)</p>
          </header>
        </div>
      </div>
    </div>
  );
}
