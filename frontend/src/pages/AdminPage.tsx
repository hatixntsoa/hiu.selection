import { FormEvent, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Container, Form, InputGroup, Modal, Table } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import FlagManager from '../components/Admin/FlagManager';
import LiveScoreboard from '../components/Admin/LiveScoreboard';
import TimerManager from '../components/Admin/TimerManager';
import LiveFeed from '../components/Dashboard/LiveFeed';
import { ActivityItem, AdminTeamDetails, Challenge, CtfTimerState, ScoreboardTeam } from '../types';
import { usePreferences } from '../context/PreferencesContext';

function AdminPage(): JSX.Element {
  const { section } = useParams<{ section?: string }>();
  const [teams, setTeams] = useState<ScoreboardTeam[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [timer, setTimer] = useState<CtfTimerState | null>(null);
  const [showDeleteTeamModal, setShowDeleteTeamModal] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<ScoreboardTeam | null>(null);
  const [deleteTeamError, setDeleteTeamError] = useState('');
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ScoreboardTeam | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamPassword, setEditTeamPassword] = useState('');
  const [editTeamLeaderEmail, setEditTeamLeaderEmail] = useState('');
  const [showEditTeamPassword, setShowEditTeamPassword] = useState(false);
  const [editTeamError, setEditTeamError] = useState('');
  const [editTeamSuccess, setEditTeamSuccess] = useState('');
  const [editTeamLoading, setEditTeamLoading] = useState(false);
  const [sharedTeamEmailState, setSharedTeamEmailState] = useState<Record<number, string>>({});
  const [isSendingAllCreds, setIsSendingAllCreds] = useState(false);
  const [sharingTeamIds, setSharingTeamIds] = useState<Record<number, boolean>>({});
  const [showTeamDetailsModal, setShowTeamDetailsModal] = useState(false);
  const [teamDetails, setTeamDetails] = useState<AdminTeamDetails | null>(null);
  const [teamDetailsLoading, setTeamDetailsLoading] = useState(false);
  const [teamDetailsError, setTeamDetailsError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pulsingScoreboardTeamIds, setPulsingScoreboardTeamIds] = useState<Set<number>>(new Set());
  const previousTeamScoresRef = useRef<Map<number, number>>(new Map());
  const pulseTimeoutsRef = useRef<Map<number, number>>(new Map());
  const liveScoreboardRef = useRef<HTMLDivElement | null>(null);
  const { t, language, localizeApiMessage } = usePreferences();
  const currentSection =
    section === 'teams' || section === 'activity' || section === 'timer' || section === 'live-scoreboard' || section === 'scoreboard' || section === 'data-export'
      ? section
      : 'flags';
  const isLiveScoreboardRoute = currentSection === 'live-scoreboard';
  const liveTimerLabel = timer?.isInfinite
    ? t('timerInfinite')
    : timer && !timer.isActive
      ? t('timerNotStarted')
    : typeof timer?.timeLeftSeconds === 'number'
      ? new Date(timer.timeLeftSeconds * 1000).toISOString().substring(11, 19)
      : t('timerFinished');
  const difficultyLabel = (difficulty?: string | null): string => {
    if (difficulty === 'medium') {
      return t('difficultyMedium');
    }
    if (difficulty === 'hard') {
      return t('difficultyHard');
    }
    return t('difficultyEasy');
  };

  const defaultLeaderEmail = (teamName: string): string => `${teamName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_leader@example.com`;

  const fetchData = async (): Promise<void> => {
    try {
      const [scoreboardRes, challengesRes, activityRes] = await Promise.all([
        api.get('/scoreboard'),
        api.get('/challenges'),
        api.get('/scoreboard/activity')
      ]);
      setTeams(scoreboardRes.data.scoreboard as ScoreboardTeam[]);
      setChallenges(challengesRes.data.challenges as Challenge[]);
      setActivity(activityRes.data.activities as ActivityItem[]);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const fetchTimer = async (): Promise<void> => {
    try {
      const timerRes = await api.get('/scoreboard/timer');
      setTimer(timerRes.data.timer as CtfTimerState);
    } catch (err) {
      console.error('Error fetching timer:', err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchTimer();

    let active = true;
    let cleanup: (() => void) | undefined;
    const setupSocket = async (): Promise<void> => {
      const { connectSocket } = await import('../services/socket');
      if (!active) {
        return;
      }
      const socket = connectSocket();
      const onScoreboardUpdate = (): void => {
        void fetchData();
      };
      socket.on('scoreboard_update', onScoreboardUpdate);
      cleanup = () => {
        socket.off('scoreboard_update', onScoreboardUpdate);
      };
    };
    void setupSocket();

    const interval = window.setInterval(() => {
      void fetchData();
    }, 2000);
    const timerInterval = window.setInterval(() => {
      void fetchTimer();
    }, 1000);

    return () => {
      active = false;
      cleanup?.();
      window.clearInterval(interval);
      window.clearInterval(timerInterval);
    };
  }, []);

  const openDeleteTeamModal = (team: ScoreboardTeam): void => {
    setDeleteTeamError('');
    setDeletingTeam(team);
    setShowDeleteTeamModal(true);
  };

  const openEditTeamModal = (team: ScoreboardTeam): void => {
    setEditingTeam(team);
    setEditTeamName(team.name);
    setEditTeamPassword('');
    setEditTeamLeaderEmail('');
    setShowEditTeamPassword(false);
    setEditTeamError('');
    setEditTeamSuccess('');
    setEditTeamLoading(false);
    setShowEditTeamModal(true);
    void api
      .get(`/auth/admin/teams/${team.id}/edit`)
      .then((response) => {
        setEditTeamName(String(response.data.team?.name || team.name));
        setEditTeamPassword(String(response.data.password || ''));
        setEditTeamLeaderEmail(String(response.data.team?.teamLeaderEmail || ''));
      })
      .catch((err) => {
        const error = err as { response?: { data?: { error?: string } } };
        setEditTeamError(localizeApiMessage(error.response?.data?.error || t('adminTeamDetailsFailed')));
      });
  };

  const closeEditTeamModal = (): void => {
    setShowEditTeamModal(false);
    setEditingTeam(null);
    setEditTeamName('');
    setEditTeamPassword('');
    setEditTeamLeaderEmail('');
    setShowEditTeamPassword(false);
    setEditTeamError('');
    setEditTeamSuccess('');
    setEditTeamLoading(false);
  };

  const handleEditTeam = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!editingTeam) {
      return;
    }

    setEditTeamError('');
    setEditTeamSuccess('');
    setEditTeamLoading(true);
    try {
      const response = await api.put(`/auth/admin/teams/${editingTeam.id}`, {
        name: editTeamName.trim(),
        password: editTeamPassword,
        teamLeaderEmail: editTeamLeaderEmail.trim()
      });
      setEditTeamSuccess(localizeApiMessage(response.data.message || 'Team updated by admin'));
      setSharedTeamEmailState((prev) => {
        const current = prev[editingTeam.id];
        const next = editTeamLeaderEmail.trim().toLowerCase();
        if (!current || current === next) {
          return prev;
        }
        const copy = { ...prev };
        delete copy[editingTeam.id];
        return copy;
      });
      await fetchData();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setEditTeamError(localizeApiMessage(error.response?.data?.error || t('adminTeamUpdateFailed')));
    } finally {
      setEditTeamLoading(false);
    }
  };

  const handleShareTeam = async (team: ScoreboardTeam): Promise<void> => {
    setSharingTeamIds((prev) => ({ ...prev, [team.id]: true }));
    try {
      await api.post(`/auth/admin/teams/${team.id}/share`);
      setSharedTeamEmailState((prev) => ({ ...prev, [team.id]: String(team.team_leader_email || '').toLowerCase() }));
    } catch {
      // handled by global notifications
    } finally {
      setSharingTeamIds((prev) => {
        const next = { ...prev };
        delete next[team.id];
        return next;
      });
    }
  };

  const handleShareAllTeams = async (): Promise<void> => {
    const orderedTeams = [...teams];
    setIsSendingAllCreds(true);
    try {
      for (const team of orderedTeams) {
        const leaderEmail = String(team.team_leader_email || '').toLowerCase();
        const isShared = leaderEmail.length > 0 && sharedTeamEmailState[team.id] === leaderEmail;
        if (isShared) {
          continue;
        }
        try {
          await api.post(`/auth/admin/teams/${team.id}/share`);
          setSharedTeamEmailState((prev) => ({ ...prev, [team.id]: leaderEmail }));
        } catch {
          // handled by global notifications, continue with next team
        }
      }
    } finally {
      setIsSendingAllCreds(false);
    }
  };

  const handleDeleteTeam = async (): Promise<void> => {
    if (!deletingTeam) {
      return;
    }
    try {
      await api.delete(`/auth/admin/teams/${deletingTeam.id}`);
      setShowDeleteTeamModal(false);
      setDeletingTeam(null);
      await fetchData();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setDeleteTeamError(error.response?.data?.error || t('adminTeamDeleteFailed'));
    }
  };

  const openTeamDetailsModal = async (team: ScoreboardTeam): Promise<void> => {
    setShowTeamDetailsModal(true);
    setTeamDetails(null);
    setTeamDetailsError('');
    setTeamDetailsLoading(true);
    try {
      const response = await api.get(`/auth/admin/teams/${team.id}`);
      setTeamDetails(response.data as AdminTeamDetails);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setTeamDetailsError(error.response?.data?.error || t('adminTeamDetailsFailed'));
    } finally {
      setTeamDetailsLoading(false);
    }
  };

  useEffect(() => {
    const onChange = (): void => {
      setIsFullscreen(document.fullscreenElement === liveScoreboardRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    return () => {
      pulseTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      pulseTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const nextScores = new Map<number, number>();
    const increasedTeamIds: number[] = [];
    teams.forEach((team) => {
      nextScores.set(team.id, team.score);
      const previousScore = previousTeamScoresRef.current.get(team.id);
      if (typeof previousScore === 'number' && team.score > previousScore) {
        increasedTeamIds.push(team.id);
      }
    });
    previousTeamScoresRef.current = nextScores;

    if (increasedTeamIds.length === 0) {
      return;
    }

    increasedTeamIds.forEach((teamId) => {
      const existingTimeout = pulseTimeoutsRef.current.get(teamId);
      if (typeof existingTimeout === 'number') {
        window.clearTimeout(existingTimeout);
      }

      setPulsingScoreboardTeamIds((previous) => {
        const next = new Set(previous);
        next.add(teamId);
        return next;
      });

      const timeout = window.setTimeout(() => {
        setPulsingScoreboardTeamIds((previous) => {
          const next = new Set(previous);
          next.delete(teamId);
          return next;
        });
        pulseTimeoutsRef.current.delete(teamId);
      }, 1500);
      pulseTimeoutsRef.current.set(teamId, timeout);
    });
  }, [teams]);

  const toggleFullscreen = async (): Promise<void> => {
    if (!liveScoreboardRef.current) {
      return;
    }
    if (document.fullscreenElement === liveScoreboardRef.current) {
      await document.exitFullscreen();
      return;
    }
    await liveScoreboardRef.current.requestFullscreen();
  };

  const getChallengeMaxPoints = (challenge: Challenge): number => {
    if (Number(challenge.first_blood_points) > 0) {
      return Number(challenge.first_blood_points);
    }
    if (challenge.difficulty === 'medium') {
      return 200;
    }
    if (challenge.difficulty === 'hard') {
      return 300;
    }
    return 100;
  };

  const maxTotalPoints = challenges.reduce((sum, challenge) => sum + getChallengeMaxPoints(challenge), 0);
  const rawPointsHeader = `${t('adminScoreRaw')} / ${maxTotalPoints}`;
  const pointsPerThirty = maxTotalPoints > 0 ? maxTotalPoints / 30 : 0;
  const scoreOverThirty = (score: number): number => {
    if (pointsPerThirty <= 0) {
      return 0;
    }
    return score / pointsPerThirty;
  };
  const formatOverThirty = (score: number): string => {
    const normalized = scoreOverThirty(score);
    return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2);
  };

  const rankLabel = (rank: number | null): string | number => {
    if (!rank) {
      return '-';
    }
    if (rank === 1) {
      return '🥇';
    }
    if (rank === 2) {
      return '🥈';
    }
    if (rank === 3) {
      return '🥉';
    }
    return rank;
  };

  const exportScoreboardPdf = async (): Promise<void> => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);

    const rows = [...teams]
      .sort((a, b) => {
        const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      })
      .map((team) => [team.rank ? String(team.rank) : '-', team.name, String(team.score), formatOverThirty(team.score)]);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    doc.setFontSize(16);
    doc.text('Selection HIU 2026 - CTF', 40, 40);
    autoTable(doc, {
      startY: 60,
      head: [[t('adminRank'), t('adminTeamName'), rawPointsHeader, t('adminScoreOverThirty')]],
      body: rows,
      styles: { fontSize: 11, cellPadding: 6 },
      headStyles: { fillColor: [52, 73, 94] }
    });
    doc.save('selection-hiu-2026-ctf-scoreboard.pdf');
  };

  const exportDataBundle = async (): Promise<void> => {
    const response = await api.get('/scoreboard/export', { responseType: 'blob' });
    const filenameHeader = String(response.headers['content-disposition'] || '');
    const match = /filename="([^"]+)"/.exec(filenameHeader);
    const filename = match?.[1] || `hiu-selection-data-exported-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    const url = URL.createObjectURL(response.data as Blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };
  const hasPendingTeamEdit = (team: ScoreboardTeam): boolean => {
    const leaderEmail = String(team.team_leader_email || '').trim().toLowerCase();
    return leaderEmail.length === 0 || leaderEmail === defaultLeaderEmail(team.name);
  };
  const allLeaderEmailsEdited = teams.every((team) => {
    return !hasPendingTeamEdit(team);
  });

  return (
    <Container fluid>
      {isLiveScoreboardRoute ? (
        <Card className="mt-2 soft-card live-scoreboard-screen" ref={liveScoreboardRef}>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <h3 className="mb-0 section-title">{t('adminLiveTitle')}</h3>
              <span className={`badge rounded-pill live-timer-pill ${timer?.canSubmit ? 'text-bg-success' : 'text-bg-danger'}`}>
                {t('timerLabel')}: {liveTimerLabel}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                void toggleFullscreen();
              }}
              title={isFullscreen ? t('adminExitFullscreen') : t('adminFullscreen')}
              aria-label={isFullscreen ? t('adminExitFullscreen') : t('adminFullscreen')}
            >
              {isFullscreen ? '⤡' : '⤢'}
            </button>
          </Card.Header>
          <Card.Body>
            <LiveScoreboard teams={teams} fullscreen={isFullscreen} />
          </Card.Body>
        </Card>
      ) : currentSection === 'flags' ? (
            <Card className="mt-3 soft-card">
              <Card.Body>
                <FlagManager onFlagChange={fetchData} />
              </Card.Body>
            </Card>
      ) : currentSection === 'scoreboard' ? (
          <Card className="mt-3 soft-card">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0 section-title">{t('adminScoreboardTitle')}</h5>
              <Button variant="outline-secondary" size="sm" onClick={() => void exportScoreboardPdf()}>
                {t('adminExportPdf')}
              </Button>
            </Card.Header>
            <Card.Body>
              <Table striped bordered hover responsive className="warm-table">
                <thead>
                  <tr>
                    <th>{t('adminRank')}</th>
                    <th>{t('adminTeamName')}</th>
                    <th>{rawPointsHeader}</th>
                    <th>{t('adminScoreOverThirty')}</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => {
                    const isPulsing = pulsingScoreboardTeamIds.has(team.id);
                    return (
                      <tr key={team.id}>
                        <td>
                          <span className={`rank-peg${isPulsing ? ' score-pulse-peg' : ''}`}>{rankLabel(team.rank)}</span>
                        </td>
                        <td>{team.name}</td>
                        <td>{team.score}</td>
                        <td>{formatOverThirty(team.score)}/30</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
      ) : currentSection === 'data-export' ? (
          <Card className="mt-3 soft-card">
            <Card.Header>
              <h5 className="mb-0 section-title">{t('adminTabDataExport')}</h5>
            </Card.Header>
            <Card.Body className="d-flex justify-content-center py-5">
              <Button size="lg" variant="primary" onClick={() => void exportDataBundle()}>
                {t('adminExportDataButton')}
              </Button>
            </Card.Body>
          </Card>
      ) : currentSection === 'teams' ? (
          <Card className="mt-3 soft-card">
            <Card.Header className="d-flex justify-content-between align-items-center gap-2">
              <h5 className="mb-0 section-title">{t('adminRegisteredTeams')}</h5>
              <Button
                variant={isSendingAllCreds ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => void handleShareAllTeams()}
                disabled={isSendingAllCreds || !allLeaderEmailsEdited}
                className={isSendingAllCreds ? 'btn-pressed-grey' : undefined}
                title={!allLeaderEmailsEdited ? t('adminTeamShareAllBlockedHint') : undefined}
              >
                {isSendingAllCreds ? t('adminTeamShareAllSending') : t('adminTeamShareAll')}
              </Button>
            </Card.Header>
            <Card.Body>
              <Table striped bordered hover responsive className="warm-table">
                <thead>
                  <tr>
                    <th>{t('adminRank')}</th>
                    <th>{t('adminTeamName')}</th>
                    <th>{t('adminScore')}</th>
                    <th>{t('adminRegistered')}</th>
                    <th style={{ width: '1%', whiteSpace: 'nowrap' }}>{t('managerTableActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team.id}>
                      <td>{rankLabel(team.rank)}</td>
                      <td>{hasPendingTeamEdit(team) ? `*${team.name}` : team.name}</td>
                      <td>
                        <strong>{team.score}</strong>
                      </td>
                      <td>{team.created_at ? new Date(team.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US') : '-'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {(() => {
                          const leaderEmail = String(team.team_leader_email || '').toLowerCase();
                          const persistedSharedEmail = String(team.creds_shared_email || '').toLowerCase();
                          const isShared =
                            leaderEmail.length > 0 &&
                            (sharedTeamEmailState[team.id] === leaderEmail || persistedSharedEmail === leaderEmail);
                          const isSharingTeam = Boolean(sharingTeamIds[team.id]);
                          return (
                            <>
                        <Button variant="primary" size="sm" className="me-2" onClick={() => openEditTeamModal(team)}>
                          {t('managerEdit')}
                        </Button>
                        <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => void openTeamDetailsModal(team)}>
                          {t('adminView')}
                        </Button>
                        <Button
                          variant={isSharingTeam ? 'secondary' : isShared ? 'success' : 'outline-primary'}
                          size="sm"
                          className={`me-2${isSharingTeam ? ' btn-pressed-grey' : ''}`}
                          onClick={() => void handleShareTeam(team)}
                          disabled={isShared || isSendingAllCreds || isSharingTeam}
                        >
                          {isShared ? t('adminTeamShared') : isSharingTeam ? t('adminTeamShareAllSending') : t('adminTeamShare')}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => openDeleteTeamModal(team)}
                        >
                          {t('managerDelete')}
                        </Button>
                            </>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
      ) : currentSection === 'activity' ? (
          <Card className="mt-3 soft-card">
            <Card.Header>
              <h5 className="mb-0 section-title">{t('adminTabActivity')}</h5>
            </Card.Header>
            <Card.Body>
              <LiveFeed activity={activity} />
            </Card.Body>
          </Card>
      ) : (
          <div className="mt-3">
            <TimerManager timer={timer} onTimerChange={setTimer} />
          </div>
      )}

      <Modal show={showEditTeamModal} onHide={closeEditTeamModal}>
        <Modal.Header closeButton>
          <Modal.Title>{t('adminTeamEditTitle')}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEditTeam}>
          <Modal.Body>
            {editTeamError ? <Alert variant="danger">{editTeamError}</Alert> : null}
            {editTeamSuccess ? <Alert variant="success">{editTeamSuccess}</Alert> : null}
            <Form.Group className="mb-3">
              <Form.Label>{t('adminTeamName')}</Form.Label>
              <Form.Control value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('adminTeamLeaderEmail')}</Form.Label>
              <Form.Control
                type="email"
                value={editTeamLeaderEmail}
                onChange={(e) => setEditTeamLeaderEmail(e.target.value)}
                placeholder="team1_leader@example.com"
                required
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>{t('loginPassword')}</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showEditTeamPassword ? 'text' : 'password'}
                  value={editTeamPassword}
                  onChange={(e) => setEditTeamPassword(e.target.value)}
                  placeholder={t('adminTeamPasswordHint')}
                  required
                  minLength={6}
                />
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => setShowEditTeamPassword((prev) => !prev)}
                  aria-label={showEditTeamPassword ? t('hidePassword') : t('showPassword')}
                  title={showEditTeamPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showEditTeamPassword ? '🙈' : '👁'}
                </Button>
              </InputGroup>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeEditTeamModal} disabled={editTeamLoading}>
              {t('managerCancel')}
            </Button>
            <Button variant="primary" type="submit" disabled={editTeamLoading}>
              {t('adminTeamUpdateButton')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={showDeleteTeamModal}
        onHide={() => {
          setShowDeleteTeamModal(false);
          setDeletingTeam(null);
          setDeleteTeamError('');
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>{t('managerDelete')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">{t('adminDeleteTeamConfirm', { team: deletingTeam?.name || '' })}</p>
          {deleteTeamError && (
            <Alert variant="danger" className="mt-3 mb-0">
              {deleteTeamError}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowDeleteTeamModal(false);
              setDeletingTeam(null);
              setDeleteTeamError('');
            }}
          >
            {t('managerCancel')}
          </Button>
          <Button variant="danger" onClick={() => void handleDeleteTeam()}>
            {t('managerDelete')}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showTeamDetailsModal}
        onHide={() => {
          setShowTeamDetailsModal(false);
          setTeamDetails(null);
          setTeamDetailsError('');
          setTeamDetailsLoading(false);
        }}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>{t('adminTeamDetailsTitle')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {teamDetailsLoading ? <p className="mb-0">{t('loading')}</p> : null}
          {!teamDetailsLoading && teamDetailsError ? (
            <Alert variant="danger" className="mb-0">
              {teamDetailsError}
            </Alert>
          ) : null}
          {!teamDetailsLoading && !teamDetailsError && teamDetails ? (
            <div className="d-flex flex-column gap-4">
              <div>
                <h6 className="mb-2">{t('adminTeamDetailsInfo')}</h6>
                <div className="d-flex flex-wrap gap-3">
                  <span>
                    <strong>{t('adminTeamName')}:</strong> {teamDetails.team.name}
                  </span>
                  <span>
                    <strong>{t('adminScore')}:</strong> {teamDetails.team.score}
                  </span>
                  <span>
                    <strong>{t('teamProfileMembers')}:</strong> {teamDetails.members.length}
                  </span>
                </div>
              </div>
              <div>
                <h6 className="mb-2">{t('teamProfileMembers')}</h6>
                {teamDetails.members.length === 0 ? (
                  <p className="mb-0 text-secondary">{t('adminTeamDetailsNoMembers')}</p>
                ) : (
                  <Table striped bordered hover responsive className="warm-table mb-0">
                    <thead>
                      <tr>
                        <th>{t('adminTeamDetailsUsername')}</th>
                        <th>{t('adminTeamDetailsRole')}</th>
                        <th>{t('adminRegistered')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamDetails.members.map((member) => (
                        <tr key={member.id}>
                          <td>{member.username}</td>
                          <td>{member.is_primary ? t('adminTeamDetailsPrimary') : t('adminTeamDetailsMember')}</td>
                          <td>{member.created_at ? new Date(member.created_at).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
              <div>
                <h6 className="mb-2">{t('adminTeamDetailsSubmissions')}</h6>
                {teamDetails.submissions.length === 0 ? (
                  <p className="mb-0 text-secondary">{t('adminTeamDetailsNoSubmissions')}</p>
                ) : (
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
                      {teamDetails.submissions.map((submission) => (
                        <tr key={submission.id}>
                          <td>{submission.challenge_public_id || '-'}</td>
                          <td>{submission.submitted_flag}</td>
                          <td>{difficultyLabel(submission.challenge_difficulty)}</td>
                          <td>{submission.is_correct ? t('adminTeamDetailsCorrect') : t('adminTeamDetailsWrong')}</td>
                          <td>{submission.awarded_points || 0}</td>
                          <td>{new Date(submission.submitted_at).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowTeamDetailsModal(false);
              setTeamDetails(null);
              setTeamDetailsError('');
              setTeamDetailsLoading(false);
            }}
          >
            {t('managerCancel')}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default AdminPage;
