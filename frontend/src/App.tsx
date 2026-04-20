import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Toast, ToastContainer } from 'react-bootstrap';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import { usePreferences } from './context/PreferencesContext';
import api from './services/api';
import { ActivityItem, CtfTimerState } from './types';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const CtfEndedPage = lazy(() => import('./pages/CtfEndedPage'));

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
    const isCompetitionRoute =
      location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/ctf-ended');
    if (!user || user.isAdmin || !isCompetitionRoute) {
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

type SolveToast = {
  id: string;
  team: string;
  points: number;
};

function RealtimeSolveToasts(): JSX.Element {
  const { user } = useAuth();
  const { t } = usePreferences();
  const location = useLocation();
  const [toasts, setToasts] = useState<SolveToast[]>([]);

  useEffect(() => {
    const isLiveRoute =
      location.pathname.startsWith('/dashboard') ||
      location.pathname.startsWith('/admin') ||
      location.pathname === '/ctf-ended';
    if (!user || !isLiveRoute) {
      return;
    }

    let isActive = true;
    let cleanup: (() => void) | undefined;
    const setupSocket = async (): Promise<void> => {
      const { connectSocket } = await import('./services/socket');
      if (!isActive) {
        return;
      }
      const socket = connectSocket();
      const onFlagCaptured = (data: ActivityItem): void => {
        const team = data.teamName || data.team_name || 'Unknown';
        const points = Number(data.points) || 0;
        const id = `${team}-${points}-${data.timestamp || data.submitted_at || Date.now()}`;
        setToasts((prev) => [{ id, team, points }, ...prev].slice(0, 5));
      };
      socket.on('flag_captured', onFlagCaptured);
      cleanup = () => {
        socket.off('flag_captured', onFlagCaptured);
      };
    };
    void setupSocket();

    return () => {
      isActive = false;
      cleanup?.();
    };
  }, [location.pathname, user]);

  return (
    <ToastContainer position="top-end" className="p-2 live-solve-toast-container">
      {toasts.map((item) => (
        <Toast
          key={item.id}
          autohide
          delay={5000}
          onClose={() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== item.id));
          }}
          className="live-solve-toast"
        >
          <Toast.Body>
            {t('solveToastSimple', { team: item.team, points: item.points })}
          </Toast.Body>
        </Toast>
      ))}
    </ToastContainer>
  );
}

function App(): JSX.Element {
  const { t } = usePreferences();

  return (
    <Router>
      <AuthProvider>
        <CompetitionLockGate />
        <RealtimeSolveToasts />
        <div className="min-vh-100">
          <Navbar />
          <main className="container py-4">
            <Suspense fallback={<div className="d-flex justify-content-center py-5">{t('loading')}</div>}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<LoginPage />} />
                <Route path="/settings" element={<SettingsPage />} />
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
                      <Navigate to="/admin/flags" replace />
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
            </Suspense>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
