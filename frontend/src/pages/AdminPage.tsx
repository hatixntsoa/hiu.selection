import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Container, Modal, Table } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import FlagManager from '../components/Admin/FlagManager';
import LiveScoreboard from '../components/Admin/LiveScoreboard';
import TimerManager from '../components/Admin/TimerManager';
import { AdminTeamDetails, CtfTimerState, ScoreboardTeam } from '../types';
import { usePreferences } from '../context/PreferencesContext';

function AdminPage(): JSX.Element {
  const { section } = useParams<{ section?: string }>();
  const [teams, setTeams] = useState<ScoreboardTeam[]>([]);
  const [timer, setTimer] = useState<CtfTimerState | null>(null);
  const [showDeleteTeamModal, setShowDeleteTeamModal] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<ScoreboardTeam | null>(null);
  const [deleteTeamError, setDeleteTeamError] = useState('');
  const [showTeamDetailsModal, setShowTeamDetailsModal] = useState(false);
  const [teamDetails, setTeamDetails] = useState<AdminTeamDetails | null>(null);
  const [teamDetailsLoading, setTeamDetailsLoading] = useState(false);
  const [teamDetailsError, setTeamDetailsError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const liveScoreboardRef = useRef<HTMLDivElement | null>(null);
  const { t, language } = usePreferences();
  const currentSection = section === 'teams' || section === 'timer' || section === 'live-scoreboard' ? section : 'flags';
  const isLiveScoreboardRoute = currentSection === 'live-scoreboard';
  const liveTimerLabel = timer?.isInfinite
    ? t('timerInfinite')
    : timer && !timer.isActive
      ? t('timerNotStarted')
    : typeof timer?.timeLeftSeconds === 'number'
      ? new Date(timer.timeLeftSeconds * 1000).toISOString().substring(11, 19)
      : t('timerFinished');

  const fetchData = async (): Promise<void> => {
    try {
      const [scoreboardRes, timerRes] = await Promise.all([api.get('/scoreboard'), api.get('/scoreboard/timer')]);
      setTeams(scoreboardRes.data.scoreboard as ScoreboardTeam[]);
      setTimer(timerRes.data.timer as CtfTimerState);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();

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

    return () => {
      active = false;
      cleanup?.();
      window.clearInterval(interval);
    };
  }, []);

  const openDeleteTeamModal = (team: ScoreboardTeam): void => {
    setDeleteTeamError('');
    setDeletingTeam(team);
    setShowDeleteTeamModal(true);
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
            <LiveScoreboard teams={teams} />
          </Card.Body>
        </Card>
      ) : currentSection === 'flags' ? (
            <Card className="mt-3 soft-card">
              <Card.Body>
                <FlagManager onFlagChange={fetchData} />
              </Card.Body>
            </Card>
      ) : currentSection === 'teams' ? (
          <Card className="mt-3 soft-card">
            <Card.Header>
              <h5 className="mb-0 section-title">{t('adminRegisteredTeams')}</h5>
            </Card.Header>
            <Card.Body>
              <Table striped bordered hover responsive className="warm-table">
                <thead>
                  <tr>
                    <th>{t('adminRank')}</th>
                    <th>{t('adminTeamName')}</th>
                    <th>{t('adminScore')}</th>
                    <th>{t('adminRegistered')}</th>
                    <th>{t('managerTableActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team, index) => (
                    <tr key={team.id}>
                      <td>#{index + 1}</td>
                      <td>{team.name}</td>
                      <td>
                        <strong>{team.score}</strong>
                      </td>
                      <td>{team.created_at ? new Date(team.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US') : '-'}</td>
                      <td>
                        <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => void openTeamDetailsModal(team)}>
                          {t('adminView')}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => openDeleteTeamModal(team)}
                        >
                          {t('managerDelete')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
      ) : (
          <div className="mt-3">
            <TimerManager timer={timer} onTimerChange={setTimer} />
          </div>
      )}

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
