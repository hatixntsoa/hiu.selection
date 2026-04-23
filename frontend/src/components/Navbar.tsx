import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Container, Form, InputGroup, Modal, Nav, Navbar as BSNavbar, Table } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import api from '../services/api';
import { CtfTimerState, SubmissionHistoryItem } from '../types';

function formatTimer(timer: CtfTimerState | null, t: (key: any, params?: Record<string, string | number>) => string): string {
  if (!timer) {
    return t('navTimerNotStartedShort');
  }
  if (!timer.isActive) {
    return t('navTimerNotStartedShort');
  }
  if (timer.isInfinite) {
    return `${t('timerLabel')}: ${t('timerInfinite')}`;
  }
  if (typeof timer.timeLeftSeconds === 'number') {
    return `${t('timerLabel')}: ${new Date(timer.timeLeftSeconds * 1000).toISOString().substring(11, 19)}`;
  }
  return `${t('timerLabel')}: ${t('timerFinished')}`;
}

function Navbar(): JSX.Element {
  const { user, logout } = useAuth();
  const { t, toggleTheme, resolvedTheme, localizeApiMessage } = usePreferences();
  const [timer, setTimer] = useState<CtfTimerState | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamSubmissions, setTeamSubmissions] = useState<SubmissionHistoryItem[]>([]);
  const [teamModalLoading, setTeamModalLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [showAdminMailModal, setShowAdminMailModal] = useState(false);
  const [adminSenderEmail, setAdminSenderEmail] = useState('');
  const [adminSenderPassword, setAdminSenderPassword] = useState('');
  const [adminOvaLink, setAdminOvaLink] = useState('');
  const [adminPlatformLink, setAdminPlatformLink] = useState('');
  const [adminCredsTemplate, setAdminCredsTemplate] = useState('');
  const [adminEmailSubject, setAdminEmailSubject] = useState('');
  const [adminMailError, setAdminMailError] = useState('');
  const [adminMailSuccess, setAdminMailSuccess] = useState('');
  const [adminMailLoading, setAdminMailLoading] = useState(false);
  const [showAdminSenderPassword, setShowAdminSenderPassword] = useState(false);
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

  const openTeamModal = (): void => {
    if (!user || user.isAdmin) {
      return;
    }
    setShowTeamModal(true);
    setTeamError('');
    setTeamModalLoading(true);
    api
      .get('/flags/history')
      .then((response) => {
        setTeamSubmissions(response.data.submissions as SubmissionHistoryItem[]);
      })
      .catch((err: any) => {
        setTeamError(localizeApiMessage(err.response?.data?.error || t('apiDatabaseError')));
      })
      .finally(() => setTeamModalLoading(false));
  };

  const openAdminMailModal = (): void => {
    if (!user?.isAdmin) {
      return;
    }
    setShowAdminMailModal(true);
    setAdminMailError('');
    setAdminMailSuccess('');
    setAdminMailLoading(true);
    api
      .get('/auth/admin/sender-config')
      .then((response) => {
        setAdminSenderEmail(String(response.data.senderEmail || ''));
        setAdminSenderPassword(String(response.data.appPassword || ''));
        setAdminOvaLink(String(response.data.ovaLink || 'https://drive.google.com'));
        setAdminPlatformLink(String(response.data.platformLink || 'https://ctf.link'));
        setAdminCredsTemplate(String(response.data.credentialsTemplate || ''));
        setAdminEmailSubject(String(response.data.emailSubject || 'HIU Selection ENI 2026 - CTF Platform Instructions'));
      })
      .catch((err: any) => {
        setAdminMailError(localizeApiMessage(err.response?.data?.error || t('apiDatabaseError')));
      })
      .finally(() => setAdminMailLoading(false));
  };

  const handleSaveAdminMailConfig = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setAdminMailError('');
    setAdminMailSuccess('');
    setAdminMailLoading(true);
    try {
      const response = await api.put('/auth/admin/sender-config', {
        senderEmail: adminSenderEmail.trim(),
        appPassword: adminSenderPassword,
        ovaLink: adminOvaLink.trim(),
        platformLink: adminPlatformLink.trim(),
        credentialsTemplate: adminCredsTemplate,
        emailSubject: adminEmailSubject.trim()
      });
      setAdminMailSuccess(localizeApiMessage(response.data.message || 'Sender credentials updated'));
    } catch (err: any) {
      setAdminMailError(localizeApiMessage(err.response?.data?.error || t('apiDatabaseError')));
    } finally {
      setAdminMailLoading(false);
    }
  };

  const isLockedForTeam = Boolean(user && !user.isAdmin && timer?.isExpired);
  const challengesDisabled = Boolean(timer && !timer.canSubmit);
  const challengesTabDisabled = Boolean(timer && !timer.isActive);
  const challengesTabDisabledReason = timer && !timer.isActive ? t('dashboardChallengesNotStarted') : undefined;
  const challengesDisabledReason =
    timer && !timer.isActive ? t('dashboardChallengesNotStarted') : challengesDisabled ? t('dashboardChallengesClosed') : undefined;
  const timerText = useMemo(() => formatTimer(timer, t), [timer, t]);

  return (
    <>
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
            <Nav className="me-auto navbar-main-links">
              {user && !user.isAdmin && !isLockedForTeam && (
                <>
                  <Nav.Link as={Link} to="/dashboard/ranking" active={location.pathname === '/dashboard/ranking'}>
                    {t('dashboardTabRanking')}
                  </Nav.Link>
                  <Nav.Link as={Link} to="/dashboard/live-activity" active={location.pathname === '/dashboard/live-activity'}>
                    {t('dashboardTabLiveActivity')}
                  </Nav.Link>
                  <Nav.Link
                    as={Link}
                    to={challengesTabDisabled ? '#' : '/dashboard/challenges'}
                    active={!challengesTabDisabled && location.pathname === '/dashboard/challenges'}
                    disabled={challengesTabDisabled}
                    title={challengesTabDisabledReason}
                    className={challengesTabDisabled ? 'challenge-tab-disabled' : undefined}
                  >
                    {t('dashboardTabChallenges')}
                  </Nav.Link>
                  <Nav.Link
                    as={Link}
                    to={challengesDisabled ? '#' : '/dashboard/submission'}
                    active={!challengesDisabled && location.pathname === '/dashboard/submission'}
                    disabled={challengesDisabled}
                    title={challengesDisabledReason}
                    className={challengesDisabled ? 'challenge-tab-disabled' : undefined}
                  >
                    {t('dashboardTabSubmission')}
                  </Nav.Link>
                </>
              )}
              {user?.isAdmin && (
                <>
                  <Nav.Link as={Link} to="/admin/flags" active={location.pathname === '/admin/flags'}>
                    {t('adminTabFlags')}
                  </Nav.Link>
                  <Nav.Link as={Link} to="/admin/teams" active={location.pathname === '/admin/teams'}>
                    {t('adminTabTeams')}
                  </Nav.Link>
                  <Nav.Link as={Link} to="/admin/activity" active={location.pathname === '/admin/activity'}>
                    {t('adminTabActivity')}
                  </Nav.Link>
                  <Nav.Link as={Link} to="/admin/timer" active={location.pathname === '/admin/timer'}>
                    {t('adminTabTimer')}
                  </Nav.Link>
                  <Nav.Link as={Link} to="/admin/scoreboard" active={location.pathname === '/admin/scoreboard'}>
                    {t('adminTabScoreboard')}
                  </Nav.Link>
                  <Nav.Link as={Link} to="/admin/live-scoreboard" active={location.pathname === '/admin/live-scoreboard'}>
                    {t('adminTabLiveScoreboard')}
                  </Nav.Link>
                  <Nav.Link as={Link} to="/admin/data-export" active={location.pathname === '/admin/data-export'}>
                    {t('adminTabDataExport')}
                  </Nav.Link>
                </>
              )}
              {!isLockedForTeam && (
                <Nav.Link as={Link} to="/settings" active={location.pathname === '/settings'}>
                  {t('navSettings')}
                </Nav.Link>
              )}
            </Nav>
            <Nav className="navbar-right-actions">
              {user ? (
                <>
                  <Nav.Item className="d-flex align-items-center navbar-user-group">
                    <Badge bg={timer?.canSubmit ? 'success' : 'secondary'} className="rounded-pill navbar-timer-badge">
                      {timerText}
                    </Badge>
                    {user.isAdmin ? (
                      <Button variant="link" className="p-0 text-body navbar-team-link" onClick={openAdminMailModal}>
                        {user.name}
                      </Button>
                    ) : (
                      <Button variant="link" className="p-0 text-body navbar-team-link" onClick={openTeamModal}>
                        {user.name}
                      </Button>
                    )}
                    {!user.isAdmin && (
                      <span className="badge rounded-pill warm-badge">{t('navPoints', { score: user.score })}</span>
                    )}
                  </Nav.Item>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    className="theme-toggle-btn"
                    onClick={toggleTheme}
                    aria-label={t('navThemeToggle')}
                    title={t('navThemeToggle')}
                  >
                    {resolvedTheme === 'dark' ? '☀︎' : '☾'}
                  </Button>
                  <Button variant="outline-secondary" size="sm" onClick={handleLogout}>
                    {t('navLogout')}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="theme-toggle-btn"
                  onClick={toggleTheme}
                  aria-label={t('navThemeToggle')}
                  title={t('navThemeToggle')}
                >
                  {resolvedTheme === 'dark' ? '☀︎' : '☾'}
                </Button>
              )}
            </Nav>
          </BSNavbar.Collapse>
        </Container>
      </BSNavbar>

      <Modal show={showTeamModal} onHide={() => setShowTeamModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{t('teamFlagSubmissionsTitle')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {teamError && <Alert variant="danger">{teamError}</Alert>}
          {teamModalLoading ? <p className="mb-0">{t('loading')}</p> : null}
          {!teamModalLoading && teamSubmissions.length === 0 ? (
            <p className="mb-0 text-secondary">{t('dashboardSubmissionNoHistory')}</p>
          ) : null}
          {!teamModalLoading && teamSubmissions.length > 0 ? (
            <Table striped bordered hover responsive className="warm-table mb-0">
              <thead>
                <tr>
                  <th>{t('managerTableId')}</th>
                  <th>{t('dashboardFlagLabel')}</th>
                  <th>{t('managerTableDifficulty')}</th>
                  <th>{t('adminTeamDetailsResult')}</th>
                  <th>{t('adminTeamDetailsPoints')}</th>
                  <th>{t('adminTeamDetailsSubmittedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {teamSubmissions.map((submission) => (
                  <tr key={submission.id}>
                    <td>{submission.challenge_public_id || '-'}</td>
                    <td>{submission.submitted_flag}</td>
                    <td>
                      {submission.challenge_difficulty === 'hard'
                        ? t('difficultyHard')
                        : submission.challenge_difficulty === 'medium'
                          ? t('difficultyMedium')
                          : t('difficultyEasy')}
                    </td>
                    <td>{submission.is_correct ? t('adminTeamDetailsCorrect') : t('adminTeamDetailsWrong')}</td>
                    <td>{submission.awarded_points || 0}</td>
                    <td>{new Date(submission.submitted_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}
        </Modal.Body>
      </Modal>

      <Modal show={showAdminMailModal} onHide={() => setShowAdminMailModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('adminSenderConfigTitle')}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveAdminMailConfig}>
          <Modal.Body>
            {adminMailError ? <Alert variant="danger">{adminMailError}</Alert> : null}
            {adminMailSuccess ? <Alert variant="success">{adminMailSuccess}</Alert> : null}
            <Form.Group className="mb-3">
              <Form.Label>{t('adminSenderEmailLabel')}</Form.Label>
              <Form.Control
                type="email"
                value={adminSenderEmail}
                onChange={(e) => setAdminSenderEmail(e.target.value)}
                placeholder="c3lf.business@gmail.com"
                required
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>{t('adminSenderPasswordLabel')}</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showAdminSenderPassword ? 'text' : 'password'}
                  value={adminSenderPassword}
                  onChange={(e) => setAdminSenderPassword(e.target.value)}
                  required
                />
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => setShowAdminSenderPassword((prev) => !prev)}
                  aria-label={showAdminSenderPassword ? t('hidePassword') : t('showPassword')}
                  title={showAdminSenderPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showAdminSenderPassword ? '🙈' : '👁'}
                </Button>
              </InputGroup>
            </Form.Group>
            <Form.Group className="mt-3">
              <Form.Label>{t('adminOvaLinkLabel')}</Form.Label>
              <Form.Control
                type="url"
                value={adminOvaLink}
                onChange={(e) => setAdminOvaLink(e.target.value)}
                placeholder="https://drive.google.com"
                required
              />
            </Form.Group>
            <Form.Group className="mt-3">
              <Form.Label>{t('adminPlatformLinkLabel')}</Form.Label>
              <Form.Control
                type="url"
                value={adminPlatformLink}
                onChange={(e) => setAdminPlatformLink(e.target.value)}
                placeholder="https://ctf.link"
                required
              />
            </Form.Group>
            <Form.Group className="mt-3">
              <Form.Label>{t('adminEmailHeaderLabel')}</Form.Label>
              <Form.Control
                type="text"
                value={adminEmailSubject}
                onChange={(e) => setAdminEmailSubject(e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group className="mt-3">
              <Form.Label>{t('adminCredentialsTemplateLabel')}</Form.Label>
              <Form.Control
                as="textarea"
                rows={12}
                value={adminCredsTemplate}
                onChange={(e) => setAdminCredsTemplate(e.target.value)}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAdminMailModal(false)} disabled={adminMailLoading}>
              {t('managerCancel')}
            </Button>
            <Button variant="primary" type="submit" disabled={adminMailLoading}>
              {t('adminSenderSave')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

export default Navbar;
