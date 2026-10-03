import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Dev-only tools: the model viewer at /?dev=models, the UI style mock-up at /?dev=ui-mock, the
// sinking / shore spray preview at /?dev=sink, the building construction preview at /?dev=build, the recruitment show stills at /?dev=fx, the carrier pigeon at /?dev=pigeon, the recruitment props at /?dev=props and
// window.bmgCapture() (see src/ui/dev).
const ModelPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/ModelPreview').then((m) => ({ default: m.ModelPreview })))
  : null;
const SinkPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/SinkPreview').then((m) => ({ default: m.SinkPreview })))
  : null;
const BuildPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/BuildPreview').then((m) => ({ default: m.BuildPreview })))
  : null;
const FxPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/FxPreview').then((m) => ({ default: m.FxPreview })))
  : null;
const PigeonPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/PigeonPreview').then((m) => ({ default: m.PigeonPreview })))
  : null;
const PropsPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/PropsPreview').then((m) => ({ default: m.PropsPreview })))
  : null;
const UiMock = import.meta.env.DEV ? lazy(() => import('./dev/uiMock/UiMock').then((m) => ({ default: m.UiMock }))) : null;
const devPage = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('dev') : null;
if (import.meta.env.DEV) {
  void import('./dev/capture').then((m) => m.installCapture());
}

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) {
  throw new Error('#app container is missing from index.html');
}
createRoot(container).render(
  <StrictMode>
    {ModelPreview && devPage === 'models' ? (
      <Suspense fallback={null}>
        <ModelPreview />
      </Suspense>
    ) : SinkPreview && devPage === 'sink' ? (
      <Suspense fallback={null}>
        <SinkPreview />
      </Suspense>
    ) : BuildPreview && devPage === 'build' ? (
      <Suspense fallback={null}>
        <BuildPreview />
      </Suspense>
    ) : FxPreview && devPage === 'fx' ? (
      <Suspense fallback={null}>
        <FxPreview />
      </Suspense>
    ) : PigeonPreview && devPage === 'pigeon' ? (
      <Suspense fallback={null}>
        <PigeonPreview />
      </Suspense>
    ) : PropsPreview && devPage === 'props' ? (
      <Suspense fallback={null}>
        <PropsPreview />
      </Suspense>
    ) : UiMock && devPage === 'ui-mock' ? (
      <Suspense fallback={null}>
        <UiMock />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
