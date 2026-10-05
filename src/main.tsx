import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle OAuth popup window callback: notify parent window and auto-close
if (typeof window !== 'undefined' && window.opener && window.opener !== window) {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  if (
    hash.includes('access_token') ||
    search.includes('code=') ||
    hash.includes('error=') ||
    search.includes('error=')
  ) {
    try {
      window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
      setTimeout(() => {
        window.close();
      }, 350);
    } catch {
      // Ignored if cross-origin opener restriction
    }
  }
}

const savedTheme = localStorage.getItem('yaqoob-theme');
document.documentElement.classList.toggle('dark', savedTheme === 'dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
