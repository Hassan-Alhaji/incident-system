import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './pages/Layout';
import Dashboard from './pages/Dashboard';
import TicketWizard from './pages/TicketWizard';
import TicketDetail from './pages/TicketDetail';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import OfflineSyncManager from './components/OfflineSyncManager';
import SessionTimeoutManager from './components/SessionTimeoutManager';
import ErrorBoundary from './components/ErrorBoundary';

// Protect routes based on auth status
const ProtectedRoute = () => {
 const { user, isLoading } = useAuth();

 if (isLoading) return <div>Loading...</div>;
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
 <ErrorBoundary>
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
 </ErrorBoundary>
 <OfflineSyncManager />
 <SessionTimeoutManager />
 </AuthProvider>
 </BrowserRouter>
 );
}

export default App;
