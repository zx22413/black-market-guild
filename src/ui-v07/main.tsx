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
// The market island up close: /v07.html?dev=market (&view=back|top|far, &weather=moonless-night, &players=3).
const MarketPreview = import.meta.env.DEV ? lazy(() => import('./dev/MarketPreview').then((m) => ({ default: m.MarketPreview }))) : null;
// Richer UI looks next to the current ones (bar, panel, buttons): /v07.html?dev=skin-lab.
const SkinLabPreview = import.meta.env.DEV ? lazy(() => import('./dev/SkinLabPreview').then((m) => ({ default: m.SkinLabPreview }))) : null;
// The link preview card (Open Graph image, 1200×630): /v07.html?dev=og-card (&shot=night).
const OgCardPreview = import.meta.env.DEV ? lazy(() => import('./dev/OgCardPreview').then((m) => ({ default: m.OgCardPreview }))) : null;
const devPage = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('dev') : null;

// Trial skin (src/ui-v07/skin/layers.css): `?skin=classic` shows the previous look to compare.
if (new URLSearchParams(window.location.search).get('skin') === 'classic') {
  document.documentElement.classList.add('skin-classic');
}

// On-device perf panel (frame timing and switches to isolate a slow part): open any page with `?perf=1`.
if (new URLSearchParams(window.location.search).get('perf') === '1') {
  void import('./perf/PerfPanel').then(({ PerfPanel }) => {
    const host = document.createElement('div');
    document.body.append(host);
    createRoot(host).render(<PerfPanel />);
  });
}

// Dev-only full-resolution capture of the 3D canvas (`await window.bmgCapture()`, see src/ui/dev/capture.ts).
if (import.meta.env.DEV) void import('../ui/dev/capture').then((m) => m.installCapture());

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) {
  throw new Error('#app container is missing from v07.html');
}
createRoot(container).render(
  <StrictMode>
    {devPage === 'og-card' && OgCardPreview ? (
      <Suspense fallback={null}>
        <OgCardPreview />
      </Suspense>
    ) : devPage === 'skin-lab' && SkinLabPreview ? (
      <Suspense fallback={null}>
        <SkinLabPreview />
      </Suspense>
    ) : devPage === 'market' && MarketPreview ? (
      <Suspense fallback={null}>
        <MarketPreview />
      </Suspense>
    ) : devPage === 'island-cards' && IslandCardsPreview ? (
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
