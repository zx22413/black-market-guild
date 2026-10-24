import { useEffect } from 'react';
import type { MenuView } from '../menu/menuSeats';
import { soundEngine } from './soundEngine';
import { soundscapeFor } from './soundPlan';

/**
 * Keeps the soundtrack in step with the screen: `menuView` is what the menu table shows (null
 * once a match screen has the table). Sound starts on the player's first touch or key press.
 */
export function useSoundtrack(menuView: MenuView | null): void {
  const { music, ambience, playback } = soundscapeFor(menuView);
  useEffect(() => soundEngine.setSoundscape({ music, ambience, playback }), [music, ambience, playback]);

  useEffect(() => {
    const unlock = () => soundEngine.unlock();
    const onVisibility = () => soundEngine.setPageVisible(document.visibilityState === 'visible');
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
