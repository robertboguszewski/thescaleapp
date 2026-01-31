/**
 * Renderer Entry Point
 *
 * Main entry point for the React renderer process.
 * Initializes the React application and mounts it to the DOM.
 *
 * @module presentation/index
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { BLEProvider } from './contexts/BLEContext';
import './styles/globals.css';

// Initialize i18n before any component renders
import '../i18n/config';

/**
 * Get the root element from the DOM
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Failed to find root element. Make sure there is a <div id="root"></div> in your HTML.'
  );
}

/**
 * Create React root and render the application
 */
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BLEProvider>
      <App />
    </BLEProvider>
  </React.StrictMode>
);

/**
 * Hot Module Replacement (HMR) support for development
 */
if (import.meta.hot) {
  import.meta.hot.accept();
}
