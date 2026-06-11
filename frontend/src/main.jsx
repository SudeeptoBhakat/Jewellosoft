import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './assets/styles/index.css';
import { toast } from './utils/toast';

window.alert = (message) => {
  const msg = String(message || '');
  const needle = msg.toLowerCase();
  if (needle.includes('error') || needle.includes('failed')) {
    toast.error(msg);
  } else if (needle.includes('warning') || needle.includes('validation')) {
    toast.warning(msg);
  } else if (needle.includes('success') || needle.includes('saved')) {
    toast.success(msg);
  } else {
    toast.info(msg);
  }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

