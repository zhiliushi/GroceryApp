import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Dev-mode safeguard: if a service worker from a previous config is still
// registered, unregister it and nuke its caches. Without this, the old SW
// keeps firing autoUpdate reloads even after we disable PWA in dev.
// Production build never enters this branch (import.meta.env.DEV is false).
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (regs.length === 0) return;
    Promise.all(regs.map((r) => r.unregister()))
      .then(() => {
        if ('caches' in window) {
          return caches.keys().then((keys) =>
            Promise.all(keys.map((k) => caches.delete(k))),
          );
        }
      })
      .then(() => {
        // eslint-disable-next-line no-console
        console.info('[dev] Unregistered stale service worker(s); reload once to pick up fresh code.');
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
