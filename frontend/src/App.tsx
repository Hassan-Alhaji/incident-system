import React, { useEffect, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingFallback from './components/LoadingFallback';

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
// Each page becomes its own chunk — only downloaded when the route is visited.
const Login         = React.lazy(() => import('./pages/Login'));
const Layout        = React.lazy(() => import('./pages/Layout'));
const Dashboard     = React.lazy(() => import('./pages/Dashboard'));
const TicketWizard  = React.lazy(() => import('./pages/TicketWizard'));
const TicketDetail  = React.lazy(() => import('./pages/TicketDetail'));
const Settings      = React.lazy(() => import('./pages/Settings'));
const Analytics     = React.lazy(() => import('./pages/Analytics'));

// ─── Light-weight, always-bundled components ──────────────────────────────────
import OfflineSyncManager from './components/OfflineSyncManager';
import SessionTimeoutManager from './components/SessionTimeoutManager';

// Protect routes based on auth status
const ProtectedRoute = () => {
 const { user, isLoading } = useAuth();

 if (isLoading) return <LoadingFallback />;
 if (!user) return <Navigate to="/login" replace />;

 return <Outlet />;
};

function App() {
 const { i18n } = useTranslation();

 useEffect(() => {
 document.dir = i18n.language.startsWith('ar') ? 'rtl' : 'ltr';
 document.documentElement.lang = i18n.language;
 }, [i18n.language]);

 return (
 <BrowserRouter>
 <AuthProvider>
 <ToastProvider>
 <ErrorBoundary>
 <Suspense fallback={<LoadingFallback />}>
 <Routes>
 <Route path="/login" element={<Login />} />

 {/* Main System Dashboard (formerly OC) */}
 <Route path="/" element={<ProtectedRoute />}>
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
