import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { loadSavedTheme } from './lib/themes';
import './index.css';

loadSavedTheme();

// Initialize language direction on app load
const savedLang = localStorage.getItem('language') || 'en';
document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = savedLang;

// Apply saved zoom level
const savedZoom = localStorage.getItem('app-zoom');
if (savedZoom) document.documentElement.style.fontSize = `${savedZoom}%`;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
