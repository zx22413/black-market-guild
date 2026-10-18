import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './v07.css';

// Dev-only: the ship-resolution beat prototypes (src/ui-v07/dev): the card at /v07.html?dev=beat,
// played on the 3D table at /v07.html?dev=beat3d.
const BeatPreview = import.meta.env.DEV ? lazy(() => import('./dev/BeatPreview').then((m) => ({ default: m.BeatPreview }))) : null;
const Beat3DPreview = import.meta.env.DEV ? lazy(() => import('./dev/Beat3DPreview').then((m) => ({ default: m.Beat3DPreview }))) : null;
// A whole round on the 3D table (invest, deploy, reroll, reveal): /v07.html?dev=round3d (or invest3d).
const Round3DPreview = import.meta.env.DEV ? lazy(() => import('./dev/Round3DPreview').then((m) => ({ default: m.Round3DPreview }))) : null;
// The island cards on their own: /v07.html?dev=island-cards (&island=lighthouse).
const IslandCardsPreview = import.meta.env.DEV ? lazy(() => import('./dev/IslandCardsPreview').then((m) => ({ default: m.IslandCardsPreview }))) : null;
const devPage = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('dev') : null;

// Trial skin (src/ui-v07/skin/layers.css): `?skin=classic` shows the previous look to compare.
if (new URLSearchParams(window.location.search).get('skin') === 'classic') {
  document.documentElement.classList.add('skin-classic');
}

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) {
  throw new Error('#app container is missing from v07.html');
}
createRoot(container).render(
  <StrictMode>
    {devPage === 'island-cards' && IslandCardsPreview ? (
      <Suspense fallback={null}>
        <IslandCardsPreview />
      </Suspense>

    ) : (devPage === 'round3d' || devPage === 'invest3d') && Round3DPreview ? (
      <Suspense fallback={null}>
        <Round3DPreview />
      </Suspense>
    ) : devPage === 'beat3d' && Beat3DPreview ? (
      <Suspense fallback={null}>
        <Beat3DPreview />
      </Suspense>
    ) : devPage === 'beat' && BeatPreview ? (
      <Suspense fallback={null}>
        <BeatPreview />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
