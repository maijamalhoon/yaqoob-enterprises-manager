import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyTheme, getSavedTheme } from './lib/theme';

// Handle OAuth popup window callback: notify parent window and auto-close
if (typeof window !== 'undefined' && window.opener && window.opener !== window) {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const rawParams = hash.startsWith('#') ? hash.slice(1) : search.startsWith('?') ? search.slice(1) : '';
  const params = new URLSearchParams(rawParams);

  const error = params.get('error') || (hash.includes('error=') ? 'oauth_error' : null);
  const errorCode = params.get('error_code') || params.get('error');
  const errorDesc = params.get('error_description');

  if (error || errorCode || errorDesc) {
    try {
      window.opener.postMessage({
        type: 'OAUTH_AUTH_ERROR',
        error: error || 'oauth_error',
        errorCode: errorCode || '',
        errorDescription: errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, ' ')) : 'OAuth error during Google authentication'
      }, '*');
    } catch {
      // Ignored if cross-origin opener restriction
    }
    setTimeout(() => {
      try { window.close(); } catch {}
    }, 2500);
  } else if (hash.includes('access_token') || search.includes('code=')) {
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    try {
      window.opener.postMessage({
        type: 'OAUTH_AUTH_SUCCESS',
        accessToken,
        refreshToken,
        hash,
        search
      }, '*');
    } catch {
      // Ignored if cross-origin opener restriction
    }
    setTimeout(() => {
      try { window.close(); } catch {}
    }, 600);
  }
}

applyTheme(getSavedTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
