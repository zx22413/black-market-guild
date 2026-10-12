import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './v07.css';

// Dev-only: the ship-resolution beat prototypes (src/ui-v07/dev): the card at /v07.html?dev=beat,
// played on the 3D table at /v07.html?dev=beat3d.
const BeatPreview = import.meta.env.DEV ? lazy(() => import('./dev/BeatPreview').then((m) => ({ default: m.BeatPreview }))) : null;
const Beat3DPreview = import.meta.env.DEV ? lazy(() => import('./dev/Beat3DPreview').then((m) => ({ default: m.Beat3DPreview }))) : null;
const devPage = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('dev') : null;

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) {
  throw new Error('#app container is missing from v07.html');
}
createRoot(container).render(
  <StrictMode>
    {devPage === 'beat3d' && Beat3DPreview ? (
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
