
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const isSquareCallback = window.location.pathname.startsWith('/square/callback');

if (isSquareCallback) {
  // On the callback route, we perform the necessary session storage operations directly
  // and then immediately redirect to the root of the application. The full app will
  // bootstrap correctly on the subsequent page load.
  console.log('[Square OAuth] Callback route detected — delaying app bootstrap');
  
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  // Per patch request, use a new guard key to prevent processing the same code twice.
  const processedGuardKey = 'square_oauth_processed';
  const lastProcessedCode = sessionStorage.getItem(processedGuardKey);

  if (code && code === lastProcessedCode) {
    console.warn('[Square OAuth] Duplicate auth code detected. Ignoring and redirecting home.');
    window.location.replace('/');
  } else if (code) {
    // Per patch request, explicitly clear any stale keys before setting new ones.
    // This is a defensive measure against broken or interrupted previous states.
    sessionStorage.removeItem('square_oauth_complete');
    sessionStorage.removeItem('square_oauth_code');
    
    // Set the markers for App.tsx to consume after redirect.
    sessionStorage.setItem('square_oauth_complete', 'true');
    sessionStorage.setItem('square_oauth_code', code);
    
    // Set the new guard key to prevent reprocessing this specific code.
    sessionStorage.setItem(processedGuardKey, code);

    window.location.replace('/');
  } else {
    console.error('[Square OAuth] Callback reached without an authorization code.');
    window.location.replace('/');
  }
  
} else {
  // Standard application bootstrap for all other routes.
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
