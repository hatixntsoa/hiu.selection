import { useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import CtfEndedPage from './pages/CtfEndedPage';
import { usePreferences } from './context/PreferencesContext';
import api from './services/api';
import { CtfTimerState } from './types';

function ProtectedRoute({
  children,
  adminOnly = false
}: {
  children: JSX.Element;
  adminOnly?: boolean;
}): JSX.Element {
  const { user, loading } = useAuth();
  const { t } = usePreferences();

  if (loading) {
    return <div className="d-flex justify-content-center align-items-center vh-100">{t('loading')}</div>;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (adminOnly && !user.isAdmin) {
    return <Navigate to="/dashboard/ranking" />;
  }

  return children;
}

function CompetitionLockGate(): null {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.isAdmin) {
      return;
    }

    let active = true;
    const checkTimer = (): void => {
      api
        .get('/scoreboard/timer')
        .then((response) => {
          if (!active) {
            return;
          }
          const timer = response.data.timer as CtfTimerState;
          if (timer.isExpired && location.pathname !== '/ctf-ended') {
            navigate('/ctf-ended', { replace: true });
            return;
          }
          if (!timer.isExpired && location.pathname === '/ctf-ended') {
            navigate('/dashboard/scoreboard', { replace: true });
          }
        })
        .catch(() => undefined);
    };

    checkTimer();
    const interval = window.setInterval(checkTimer, 1000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [location.pathname, navigate, user]);

  return null;
}

function App(): JSX.Element {
  return (
    <Router>
      <AuthProvider>
        <CompetitionLockGate />
        <div className="min-vh-100">
          <Navbar />
          <main className="container py-4">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<LoginPage />} />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Navigate to="/dashboard/ranking" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/:section"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/:section"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ctf-ended"
                element={
                  <ProtectedRoute>
                    <CtfEndedPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
