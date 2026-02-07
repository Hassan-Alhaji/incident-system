import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import IncidentWizard from './pages/IncidentWizard';
import Dashboard from './pages/Dashboard';
import TicketDetail from './pages/TicketDetail';
import PublicVerify from './pages/PublicVerify';
import Settings from './pages/Settings';
import MarshalLayout from './pages/marshal/MarshalLayout';
import MarshalLogin from './pages/marshal/MarshalLogin';
import MarshalDashboard from './pages/marshal/MarshalDashboard';
import MarshalTicketForm from './pages/marshal/MarshalTicketForm';
import MarshalProfile from './pages/marshal/MarshalProfile';
import UserProfile from './pages/UserProfile';

// Protect routes based on auth status
const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/verify/:token" element={<PublicVerify />} />

          {/* Marshal Portal */}
          <Route path="/marshal/login" element={<MarshalLogin />} />
          <Route path="/marshal" element={<MarshalLayout />}>
            <Route path="dashboard" element={<MarshalDashboard />} />
            <Route path="new" element={<MarshalTicketForm />} />
            <Route path="profile" element={<MarshalProfile />} />
            <Route index element={<Navigate to="dashboard" />} />
          </Route>

          {/* Admin / Ops Panel */}
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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
