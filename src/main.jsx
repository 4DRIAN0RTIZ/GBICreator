import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './lib/vendor/crystal-alert/crystal-alert.css';
import '../style.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
