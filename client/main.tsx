import { OwnerPanel } from '../modules/owner/owner-panel';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ControlPanel } from '../modules/panel/control-panel';
import { ToastCenter } from '../components/ui/toast-center';
import '../app/globals.css';
import { LandingPage } from '../modules/landing/landing-page';
const path = window.location.pathname.replace(/\/$/, '');
const host = window.location.hostname;
const screen = host === 'fiveiso.com' || host === 'www.fiveiso.com'
  ? <LandingPage />
  : host === 'panel.fiveiso.com'
    ? path === '/owner' ? <OwnerPanel /> : <ControlPanel />
    : path === '/panel' ? <ControlPanel /> : path === '/owner' ? <OwnerPanel /> : <LandingPage />;
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastCenter />
    {screen}
  </React.StrictMode>,
);
