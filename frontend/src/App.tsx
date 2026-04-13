import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import IncidentWizard from './pages/IncidentWizard';
import Dashboard from './pages/Dashboard';
import TicketDetail from './pages/TicketDetail';
import PublicVerify from './pages/PublicVerify';
import Settings from './pages/Settings';
import OCLayout from './pages/oc/OCLayout';
import OCLogin from './pages/oc/OCLogin';
import OCDashboard from './pages/oc/OCDashboard';
import OCTicketWizard from './pages/oc/OCTicketWizard';
import OCTicketDetail from './pages/oc/OCTicketDetail';
import OCSettings from './pages/oc/OCSettings';
import OCAnalytics from './pages/oc/OCAnalytics';
import UserProfile from './pages/UserProfile';
import OfflineSyncManager from './components/OfflineSyncManager';
import SessionTimeoutManager from './components/SessionTimeoutManager';

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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/verify/:token" element={<PublicVerify />} />

          {/* Marshal redirect — merged into In-Circuit */}
          <Route path="/marshal/*" element={<Navigate to="/login" replace />} />

          {/* Off-Circuit Portal */}
          <Route path="/oc/login" element={<OCLogin />} />
          <Route path="/oc" element={<OCLayout />}>
            <Route path="dashboard" element={<OCDashboard />} />
            <Route path="tickets/new" element={<OCTicketWizard />} />
            <Route path="tickets/:id" element={<OCTicketDetail />} />
            <Route path="settings" element={<OCSettings />} />
            <Route path="analytics" element={<OCAnalytics />} />
            <Route index element={<Navigate to="dashboard" />} />
          </Route>

          {/* Admin / Ops Panel (In-Circuit) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tickets/new" element={<IncidentWizard />} />
              <Route path="/tickets/:id" element={<TicketDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<UserProfile />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
        </Routes>
        <OfflineSyncManager />
        <SessionTimeoutManager />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

