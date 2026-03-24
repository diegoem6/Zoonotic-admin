import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/UI';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Clients from './pages/Clients';
import Collaborators from './pages/Collaborators';
import Billing from './pages/Billing';
import Expenses from './pages/Expenses';
import Taxes from './pages/Taxes';
import CashFlow from './pages/CashFlow';
import Payments from './pages/Payments';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>
      Cargando...
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/projects" element={<RequireAuth><Projects /></RequireAuth>} />
        <Route path="/projects/:id" element={<RequireAuth><ProjectDetail /></RequireAuth>} />
        <Route path="/clients" element={<RequireAuth><Clients /></RequireAuth>} />
        <Route path="/collaborators" element={<RequireAuth><Collaborators /></RequireAuth>} />
        <Route path="/billing" element={<RequireAuth><Billing /></RequireAuth>} />
        <Route path="/expenses" element={<RequireAuth><Expenses /></RequireAuth>} />
        <Route path="/taxes" element={<RequireAuth><Taxes /></RequireAuth>} />
        <Route path="/cashflow" element={<RequireAuth><CashFlow /></RequireAuth>} />
        <Route path="/payments" element={<RequireAuth><Payments /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastProvider />
    </AuthProvider>
  );
}
