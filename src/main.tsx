import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);
// Buildben a landing előre renderelve érkezik (scripts/prerender.mjs): hidratáljuk.
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);

// Offline működés: a service worker első látogatáskor eltárolja az alkalmazás fájljait.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
