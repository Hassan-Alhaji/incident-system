import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n';
import App from './App.tsx'

// Handle dynamic import / chunk loading errors when a new version is deployed
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Preload error detected (likely new version deployed). Reloading page...', event);
  const lastReload = parseInt(sessionStorage.getItem('last_vite_preload_reload') || '0', 10);
  const now = Date.now();
  // Prevent infinite reload loops: only reload once every 10 seconds
  if (now - lastReload > 10000) {
    sessionStorage.setItem('last_vite_preload_reload', now.toString());
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
