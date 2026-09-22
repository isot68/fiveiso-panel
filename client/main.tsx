import { OwnerPanel } from '../modules/owner/owner-panel';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ControlPanel } from '../modules/panel/control-panel';
import { ToastCenter } from '../components/ui/toast-center';
import '../app/globals.css';
import { LandingPage } from '../modules/landing/landing-page';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastCenter />
    {window.location.pathname.replace(/\/$/, '') === '/panel' ? <ControlPanel /> : window.location.pathname.replace(/\/$/, '') === '/owner' ? <OwnerPanel /> : <LandingPage />}
  </React.StrictMode>,
);
