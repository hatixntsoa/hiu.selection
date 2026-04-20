import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Container, Form, Modal, Nav, Navbar as BSNavbar } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import api from '../services/api';
import { CtfTimerState, TeamMember } from '../types';

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
  const { user, logout, updateUser } = useAuth();
  const { t, toggleTheme, resolvedTheme, localizeApiMessage } = usePreferences();
  const [timer, setTimer] = useState<CtfTimerState | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [maxMembers, setMaxMembers] = useState(6);
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [editingMemberUsername, setEditingMemberUsername] = useState('');
  const [teamError, setTeamError] = useState('');
  const [teamSuccess, setTeamSuccess] = useState('');
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

  const loadMembers = async (): Promise<void> => {
    const response = await api.get('/auth/team/members');
    const nextMembers = response.data.members as TeamMember[];
    setMembers(nextMembers);
    const nextMemberCount = Number(response.data.memberCount) || nextMembers.filter((member) => member.is_primary !== 1).length;
    setMemberCount(nextMemberCount);
    setMaxMembers(Number(response.data.maxMembers) || 6);
    updateUser({ memberCount: nextMemberCount });
  };

  const openTeamModal = (): void => {
    if (!user || user.isAdmin) {
      return;
    }
    setShowTeamModal(true);
    setTeamName(user.name);
    setNewMemberUsername('');
    setEditingMemberId(null);
    setEditingMemberUsername('');
    setTeamError('');
    setTeamSuccess('');
    void loadMembers().catch(() => undefined);
  };

  const handleSaveTeamName = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setTeamError('');
    setTeamSuccess('');
    try {
      const response = await api.put('/auth/team', { name: teamName.trim() });
      const updatedTeam = response.data.team as { name: string; memberCount?: number };
      updateUser({ name: updatedTeam.name, memberCount: updatedTeam.memberCount });
      setTeamSuccess(localizeApiMessage(response.data.message || 'Team updated'));
    } catch (err: any) {
      setTeamError(localizeApiMessage(err.response?.data?.error || t('apiDatabaseError')));
    }
  };

  const handleAddMember = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setTeamError('');
    setTeamSuccess('');
    try {
      const response = await api.post('/auth/team/members', { username: newMemberUsername.trim() });
      setTeamSuccess(localizeApiMessage(response.data.message || 'Member added'));
      setNewMemberUsername('');
      await loadMembers();
    } catch (err: any) {
      setTeamError(localizeApiMessage(err.response?.data?.error || t('apiDatabaseError')));
    }
  };

  const beginEditMember = (member: TeamMember): void => {
    if (member.is_primary === 1) {
      return;
    }
    setEditingMemberId(member.id);
    setEditingMemberUsername(member.username);
    setTeamError('');
    setTeamSuccess('');
  };

  const cancelEditMember = (): void => {
    setEditingMemberId(null);
    setEditingMemberUsername('');
  };

  const handleSaveMemberEdit = async (memberId: number): Promise<void> => {
    setTeamError('');
    setTeamSuccess('');
    try {
      const response = await api.put(`/auth/team/members/${memberId}`, { username: editingMemberUsername.trim() });
      setTeamSuccess(localizeApiMessage(response.data.message || 'Member updated'));
      cancelEditMember();
      await loadMembers();
    } catch (err: any) {
      setTeamError(localizeApiMessage(err.response?.data?.error || t('apiDatabaseError')));
    }
  };

  const handleDeleteMember = async (member: TeamMember): Promise<void> => {
    if (member.is_primary === 1) {
      return;
    }
    if (!window.confirm(t('teamProfileDeleteConfirm', { username: member.username }))) {
      return;
    }
    setTeamError('');
    setTeamSuccess('');
    try {
      const response = await api.delete(`/auth/team/members/${member.id}`);
      setTeamSuccess(localizeApiMessage(response.data.message || 'Member deleted'));
      if (editingMemberId === member.id) {
        cancelEditMember();
      }
      await loadMembers();
    } catch (err: any) {
      setTeamError(localizeApiMessage(err.response?.data?.error || t('apiDatabaseError')));
    }
  };

  const isLockedForTeam = Boolean(user && !user.isAdmin && timer?.isExpired);
  const challengesDisabled = Boolean(timer && !timer.canSubmit);
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
                  <Nav.Link as={Link} to="/dashboard/scoreboard" active={location.pathname === '/dashboard/scoreboard'}>
                    {t('dashboardTabScoreboard')}
                  </Nav.Link>
                  <Nav.Link as={Link} to="/dashboard/live-activity" active={location.pathname === '/dashboard/live-activity'}>
                    {t('dashboardTabLiveActivity')}
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
                  <Nav.Link as={Link} to="/admin/timer" active={location.pathname === '/admin/timer'}>
                    {t('adminTabTimer')}
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
            <Nav className="navbar-right-actions">
              {user ? (
                <>
                  <Nav.Item className="d-flex align-items-center navbar-user-group">
                    <Badge bg={timer?.canSubmit ? 'success' : 'secondary'} className="rounded-pill navbar-timer-badge">
                      {timerText}
                    </Badge>
                    {user.isAdmin ? (
                      <span className="text-body">{user.name}</span>
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
          <Modal.Title>{t('teamProfileTitle')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {teamError && <Alert variant="danger">{teamError}</Alert>}
          {teamSuccess && <Alert variant="success">{teamSuccess}</Alert>}

          <Form onSubmit={handleSaveTeamName} className="mb-4">
            <Form.Label>{t('teamProfileName')}</Form.Label>
            <div className="d-flex gap-2">
              <Form.Control value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
              <Button type="submit" variant="primary">
                {t('teamProfileSaveName')}
              </Button>
            </div>
          </Form>

          <h6 className="section-title mb-2">{t('teamProfileMembers')}</h6>
          <p className="text-secondary small mb-2">{t('teamProfileMembersHint', { count: memberCount, max: maxMembers })}</p>
          <div className="team-members-list mb-3">
            {members.map((member) => (
              <div key={member.id} className="team-member-pill d-flex align-items-center gap-2">
                {editingMemberId === member.id ? (
                  <>
                    <Form.Control
                      size="sm"
                      value={editingMemberUsername}
                      onChange={(e) => setEditingMemberUsername(e.target.value)}
                      className="team-member-edit-input"
                    />
                    <Button
                      size="sm"
                      variant="success"
                      className="team-member-icon-btn"
                      onClick={() => void handleSaveMemberEdit(member.id)}
                      title={t('teamProfileSaveMember')}
                      aria-label={t('teamProfileSaveMember')}
                    >
                      <span aria-hidden="true">✓</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="team-member-icon-btn"
                      onClick={cancelEditMember}
                      title={t('teamProfileCancel')}
                      aria-label={t('teamProfileCancel')}
                    >
                      <span aria-hidden="true">✕</span>
                    </Button>
                  </>
                ) : (
                  <>
                    <span>{member.username}</span>
                    {member.is_primary === 1 ? (
                      <Badge bg="secondary">{t('teamProfileTeamNameTag')}</Badge>
                    ) : (
                      <div className="d-flex align-items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          className="team-member-icon-btn"
                          onClick={() => beginEditMember(member)}
                          title={t('teamProfileEditMember')}
                          aria-label={t('teamProfileEditMember')}
                        >
                          <span aria-hidden="true">✎</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          className="team-member-icon-btn"
                          onClick={() => void handleDeleteMember(member)}
                          title={t('teamProfileDeleteMember')}
                          aria-label={t('teamProfileDeleteMember')}
                        >
                          <span aria-hidden="true">🗑</span>
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <Form onSubmit={handleAddMember}>
            <Form.Label>{t('teamProfileAddMember')}</Form.Label>
            <div className="d-flex gap-2">
              <Form.Control
                value={newMemberUsername}
                onChange={(e) => setNewMemberUsername(e.target.value)}
                placeholder={t('teamProfileUsernamePlaceholder')}
                disabled={memberCount >= maxMembers}
                required
              />
              <Button type="submit" variant="success" disabled={memberCount >= maxMembers}>
                +
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default Navbar;
