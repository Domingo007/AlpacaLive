/*
 * AlpacaLive — Your Companion Through Cancer Treatment
 * Copyright (C) 2025 AlpacaLive Contributors
 * Licensed under AGPL-3.0 — see LICENSE file
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './lib/i18n';
import { initMedicalData } from './lib/medical-data/loader';
import './index.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Initialize medical reference data (loads from cache/CDN, falls back to bundled)
initMedicalData().catch(() => {
  // Non-fatal — bundled defaults will be used
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
