import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Catch dynamic module preload errors that occur when a new version is deployed
// and an open browser tab requests an obsolete chunk hash that no longer exists on the server.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const reloadKey = 'keg_swap_preload_reload';
  const lastReload = sessionStorage.getItem(reloadKey);
  const now = Date.now();

  // Prevent infinite reload loops (allow at most 1 automatic reload per 10 seconds)
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem(reloadKey, String(now));
    window.location.reload();
  } else {
    console.error('Failed to load dynamically imported module after reload attempt.', event);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
