import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { VirtualOpdPortal } from './components/virtual-opd/VirtualOpdPortal';
import { RoleAccessPortal } from './components/portal/RoleAccessPortal';
import './styles/index.css';

const isAdmin = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
const isVirtualOpd = window.location.pathname === '/virtual-opd' || window.location.pathname.startsWith('/virtual-opd/');
const isPortal = window.location.pathname === '/portal' || window.location.pathname.startsWith('/portal/');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdmin ? <AdminDashboard /> : isPortal ? <RoleAccessPortal /> : isVirtualOpd ? <VirtualOpdPortal /> : <App />}
  </React.StrictMode>
);
