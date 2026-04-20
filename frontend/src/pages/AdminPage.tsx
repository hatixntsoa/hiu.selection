import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Container, Modal, Table } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import ChallengeManager from '../components/Admin/ChallengeManager';
import LiveScoreboard from '../components/Admin/LiveScoreboard';
import TimerManager from '../components/Admin/TimerManager';
import { CtfTimerState, ScoreboardTeam } from '../types';
import { usePreferences } from '../context/PreferencesContext';

function AdminPage(): JSX.Element {
  const { section } = useParams<{ section?: string }>();
  const [teams, setTeams] = useState<ScoreboardTeam[]>([]);
  const [timer, setTimer] = useState<CtfTimerState | null>(null);
  const [showDeleteTeamModal, setShowDeleteTeamModal] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<ScoreboardTeam | null>(null);
  const [deleteTeamError, setDeleteTeamError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const liveScoreboardRef = useRef<HTMLDivElement | null>(null);
  const { t, language } = usePreferences();
  const currentSection = section === 'teams' || section === 'timer' || section === 'live-scoreboard' ? section : 'challenges';
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
      ) : currentSection === 'challenges' ? (
            <Card className="mt-3 soft-card">
              <Card.Body>
                <ChallengeManager onChallengeChange={fetchData} />
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
                        <Button variant="danger" size="sm" onClick={() => openDeleteTeamModal(team)}>
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
    </Container>
  );
}

export default AdminPage;
