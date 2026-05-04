import React, { useEffect, useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingFallback from './components/LoadingFallback';
import api from './utils/api';

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
// Each page becomes its own chunk — only downloaded when the route is visited.
const Login            = React.lazy(() => import('./pages/Login'));
const Layout           = React.lazy(() => import('./pages/Layout'));
const Dashboard        = React.lazy(() => import('./pages/Dashboard'));
const TicketWizard     = React.lazy(() => import('./pages/TicketWizard'));
const TicketDetail     = React.lazy(() => import('./pages/TicketDetail'));
const Settings         = React.lazy(() => import('./pages/Settings'));
const Analytics        = React.lazy(() => import('./pages/Analytics'));
const MaintenancePage  = React.lazy(() => import('./pages/MaintenancePage'));

// ─── Light-weight, always-bundled components ──────────────────────────────────
import OfflineSyncManager from './components/OfflineSyncManager';
import SessionTimeoutManager from './components/SessionTimeoutManager';


// During maintenance: show maintenance page + visible admin login toggle
const MaintenanceLogin = () => {
 const [showLogin, setShowLogin] = React.useState(false);
 if (showLogin) return (
  <div className="relative">
   <Login />
   <button
    onClick={() => setShowLogin(false)}
    className="fixed top-4 left-4 z-50 text-slate-500 hover:text-red-400 text-xs font-bold px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
   >
    ← Back to Maintenance
   </button>
  </div>
 );
 return (
  <div className="relative">
   <MaintenancePage />
   <button
    onClick={() => setShowLogin(true)}
    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-white text-xs font-bold px-6 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all flex items-center gap-2 shadow-lg"
   >
    🔐 Admin Login
   </button>
  </div>
 );
};

// Protect routes based on auth status + maintenance mode
const ProtectedRoute = ({ maintenanceMode }: { maintenanceMode: boolean }) => {
 const { user, isLoading } = useAuth();

 if (isLoading) return <LoadingFallback />;
 if (!user) return <Navigate to="/login" replace />;

 // If maintenance is ON and user is NOT admin → force logout
 if (maintenanceMode && user.role !== 'ADMIN') {
  return <Navigate to="/login" replace />;
 }

 return <Outlet />;
};

function App() {
 const { i18n } = useTranslation();
 const [maintenanceMode, setMaintenanceMode] = useState(false);
 const [maintenanceChecked, setMaintenanceChecked] = useState(false);

 useEffect(() => {
 document.dir = i18n.language.startsWith('ar') ? 'rtl' : 'ltr';
 document.documentElement.lang = i18n.language;
 }, [i18n.language]);

 // Check maintenance status on app load
 useEffect(() => {
  const checkMaintenance = async () => {
   try {
    const res = await api.get('/maintenance');
    setMaintenanceMode(res.data.enabled === true);
   } catch {
    // If the endpoint fails, assume no maintenance (don't block users)
    setMaintenanceMode(false);
   } finally {
    setMaintenanceChecked(true);
   }
  };
  checkMaintenance();
  // Re-check every 60 seconds
  const interval = setInterval(checkMaintenance, 60_000);
  return () => clearInterval(interval);
 }, []);

 if (!maintenanceChecked) return <LoadingFallback />;

 return (
 <BrowserRouter>
 <AuthProvider>
 <ToastProvider>
 <ErrorBoundary>
 <Suspense fallback={<LoadingFallback />}>
 <Routes>
 {/* Login page — if maintenance is on, show maintenance with admin escape hatch */}
 <Route path="/login" element={
  maintenanceMode ? <MaintenanceLogin /> : <Login />
 } />

 {/* Main System Dashboard (formerly OC) */}
 <Route path="/" element={<ProtectedRoute maintenanceMode={maintenanceMode} />}>
 <Route element={<Layout />}>
 <Route path="dashboard" element={<Dashboard />} />
 <Route path="tickets/new" element={<TicketWizard />} />
 <Route path="tickets/:id" element={<TicketDetail />} />
 <Route path="settings" element={<Settings />} />
 <Route path="analytics" element={<Analytics />} />
 <Route index element={<Navigate to="dashboard" />} />
 </Route>
 </Route>

 <Route path="*" element={<Navigate to="/login" replace />} />
 </Routes>
 </Suspense>
 </ErrorBoundary>
 <OfflineSyncManager />
 <SessionTimeoutManager />
 </ToastProvider>
 </AuthProvider>
 </BrowserRouter>
 );
}

export default App;
