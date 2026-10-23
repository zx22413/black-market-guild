import { Suspense, lazy, useState } from 'react';

// The main menu's background: the live table (MenuScene, loaded on demand like the match table),
// faded in once its models are ready. Until then, and if WebGL fails, a plain sea-colored page.

const MenuScene = lazy(() => import('./MenuScene').then((m) => ({ default: m.MenuScene })));

export function MenuBackdrop() {
  const [ready, setReady] = useState(false);
  return (
    <div className={`menu-backdrop ${ready ? 'ready' : ''}`} aria-hidden="true">
      <Suspense fallback={null}>
        <MenuScene onReady={() => setReady(true)} />
      </Suspense>
    </div>
  );
}
