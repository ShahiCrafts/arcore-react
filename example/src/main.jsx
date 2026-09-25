import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize Capacitor
import { Capacitor } from '@capacitor/core';

console.log('Capacitor platform:', Capacitor.getPlatform());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
