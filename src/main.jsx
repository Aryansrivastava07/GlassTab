// Synchronous focus override for Chrome & Edge New Tab Pages
try {
  const raw = localStorage.getItem('landing_features_config_v1');
  let autoFocus = true;
  if (raw) {
    const cfg = JSON.parse(raw);
    if (cfg && (cfg.search === false || cfg.autoFocusSearch === false)) {
      autoFocus = false;
    }
  }
  if (autoFocus && !window.location.search.includes('focus')) {
    window.location.search = '?focus';
    throw new Error('Focus override reload');
  }
} catch (e) {
  if (e && e.message === 'Focus override reload') {
    throw e;
  }
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
