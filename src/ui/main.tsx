import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) {
  throw new Error('#app container is missing from index.html');
}
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
