import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Dev-only tools: the model viewer at /?dev=models and window.bmgCapture() (see src/ui/dev).
const ModelPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/ModelPreview').then((m) => ({ default: m.ModelPreview })))
  : null;
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
    ) : (
      <App />
    )}
  </StrictMode>,
);
