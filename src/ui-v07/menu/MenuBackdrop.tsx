import { Suspense, lazy, useState } from 'react';
import type { MenuView } from './menuSeats';

// The main menu's background: the live table (MenuScene, loaded on demand like the match table),
// faded in once its models are ready. Until then, and if WebGL fails, a plain sea-colored page.
// During a launch the page dims toward the match screen's loading color as the ships sail out.

const MenuScene = lazy(() => import('./MenuScene').then((m) => ({ default: m.MenuScene })));

export function MenuBackdrop({ view }: { readonly view: MenuView }) {
  const [ready, setReady] = useState(false);
  return (
    <div className={`menu-backdrop ${ready ? 'ready' : ''}`} aria-hidden="true">
      <Suspense fallback={null}>
        <MenuScene view={view} onReady={() => setReady(true)} />
      </Suspense>
      {view.stage === 'launch' && <div className="menu-launch-fade" />}
    </div>
  );
}
