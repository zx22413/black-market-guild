import { soundEngine } from '../audio/soundEngine';
import { CinnabarChop, GameTitle } from '../skin/titleMark';

// The first screen: browsers keep a page silent until the player touches it, so the cover asks
// for one click. That click unlocks the soundscape, and the menu music opens with the table.

interface StartGateProps {
  readonly onStart: () => void;
}

export function StartGate({ onStart }: StartGateProps) {
  const start = () => {
    soundEngine.unlock();
    onStart();
  };
  return (
    <button type="button" className="start-gate" onClick={start} autoFocus>
      <span className="menu-title-mark">
        <span className="start-gate-title">
          <GameTitle />
        </span>
        <CinnabarChop className="menu-title-chop" />
      </span>
      <span className="start-gate-prompt">點擊開始遊戲</span>
    </button>
  );
}
