import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Container, Nav, Navbar as BSNavbar } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import api from '../services/api';
import { CtfTimerState } from '../types';

function Navbar(): JSX.Element {
  const { user, logout } = useAuth();
  const { t, toggleTheme, resolvedTheme } = usePreferences();
  const [timer, setTimer] = useState<CtfTimerState | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = (): void => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    if (!user) {
      setTimer(null);
      return;
    }
    let mounted = true;
    const loadTimer = (): void => {
      api
        .get('/scoreboard/timer')
        .then((response) => {
          if (mounted) {
            setTimer(response.data.timer as CtfTimerState);
          }
        })
        .catch(() => undefined);
    };
    loadTimer();
    const interval = window.setInterval(loadTimer, 1000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [user]);

  const isLockedForTeam = Boolean(user && !user.isAdmin && timer?.isExpired);
  const challengesDisabled = Boolean(timer && !timer.canSubmit);
  return (
    <BSNavbar expand="lg" className="app-navbar shadow-sm">
      <Container>
        <BSNavbar.Brand as={Link} to="/" className="fw-bold brand-block">
          <span className="brand-main">
            <span className="brand-mark">⚑</span>
            <span>HIU Selection</span>
          </span>
        </BSNavbar.Brand>
        <BSNavbar.Toggle aria-controls="navbar-nav" />
        <BSNavbar.Collapse id="navbar-nav">
          <Nav className="me-auto">
            {user && !user.isAdmin && !isLockedForTeam && (
              <>
                <Nav.Link as={Link} to="/dashboard/ranking" active={location.pathname === '/dashboard/ranking'}>
                  {t('dashboardTabRanking')}
                </Nav.Link>
                <Nav.Link
                  as={Link}
                  to="/dashboard/scoreboard"
                  active={location.pathname === '/dashboard/scoreboard'}
                >
                  {t('dashboardTabScoreboard')}
                </Nav.Link>
                <Nav.Link
                  as={Link}
                  to="/dashboard/live-activity"
                  active={location.pathname === '/dashboard/live-activity'}
                >
                  {t('dashboardTabLiveActivity')}
                </Nav.Link>
                <Nav.Link
                  as={Link}
                  to={challengesDisabled ? '#' : '/dashboard/challenges'}
                  active={!challengesDisabled && location.pathname === '/dashboard/challenges'}
                  disabled={challengesDisabled}
                  title={challengesDisabled ? t('dashboardChallengesClosed') : undefined}
                >
                  {t('dashboardTabChallenges')}
                </Nav.Link>
              </>
            )}
            {user?.isAdmin && (
              <>
                <Nav.Link as={Link} to="/admin" active={location.pathname === '/admin'}>
                  {t('navAdmin')}
                </Nav.Link>
                <Nav.Link as={Link} to="/admin/live-scoreboard" active={location.pathname === '/admin/live-scoreboard'}>
                  {t('adminTabLiveScoreboard')}
                </Nav.Link>
              </>
            )}
            {!isLockedForTeam && (
              <Nav.Link as={Link} to="/settings" active={location.pathname === '/settings'}>
              {t('navSettings')}
              </Nav.Link>
            )}
          </Nav>
          <Nav>
            <Button
              variant="outline-secondary"
              size="sm"
              className="me-2"
              onClick={toggleTheme}
              aria-label={t('navThemeToggle')}
              title={t('navThemeToggle')}
            >
              {resolvedTheme === 'dark' ? `☀ ${t('navThemeLight')}` : `☾ ${t('navThemeDark')}`}
            </Button>
            {user ? (
              <>
                <Nav.Item className="d-flex align-items-center me-3">
                  <span className="text-body">{user.name}</span>
                  <span className="badge rounded-pill warm-badge ms-2">{t('navPoints', { score: user.score })}</span>
                </Nav.Item>
                <Button variant="outline-secondary" size="sm" onClick={handleLogout}>
                  {t('navLogout')}
                </Button>
              </>
            ) : (
              <>
                <Nav.Link as={Link} to="/auth" active={location.pathname === '/auth'}>
                  {t('navLogin')}
                </Nav.Link>
                <Link className="btn btn-primary" to="/auth">
                  {t('navGetStarted')}
                </Link>
              </>
            )}
          </Nav>
        </BSNavbar.Collapse>
      </Container>
    </BSNavbar>
  );
}

export default Navbar;
