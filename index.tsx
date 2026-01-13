import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import SquareCallback from './components/SquareCallback';
import { isSquareCallbackRoute } from './utils/isSquareCallbackRoute';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {isSquareCallbackRoute() ? <SquareCallback /> : <App />}
  </React.StrictMode>
);