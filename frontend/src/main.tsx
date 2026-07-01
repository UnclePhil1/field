import React from 'react';
import ReactDOM from 'react-dom/client';

// Self-hosted fonts (no CDN). Inter for everything; mono for live numbers.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';

import './styles/theme.css';
import './styles/globals.css';

// Initialise Reown AppKit (wallet modal) once, before the app renders.
import './lib/appkit';

import { App } from './app/App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
