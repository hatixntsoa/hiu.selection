import { useEffect, useRef, useState } from 'react';
import { Card, Col, Container, Row, Table } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import ChallengeManager from '../components/Admin/ChallengeManager';
import LiveScoreboard from '../components/Admin/LiveScoreboard';
import TimerManager from '../components/Admin/TimerManager';
import { CtfTimerState, ScoreboardTeam } from '../types';
import { usePreferences } from '../context/PreferencesContext';
import { connectSocket } from '../services/socket';

function AdminPage(): JSX.Element {
  const { section } = useParams<{ section?: string }>();
  const [teams, setTeams] = useState<ScoreboardTeam[]>([]);
  const [timer, setTimer] = useState<CtfTimerState | null>(null);
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

    const socket = connectSocket();
    socket.on('scoreboard_update', fetchData);

    return () => {
      socket.off('scoreboard_update', fetchData);
    };
  }, []);

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

  useEffect(() => {
    const interval = window.setInterval(() => {
      api
        .get('/scoreboard/timer')
        .then((response) => setTimer(response.data.timer as CtfTimerState))
        .catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h2 className="section-title">{t('adminTitle')}</h2>
          <p className="text-secondary">{t('adminSubtitle')}</p>
        </Col>
      </Row>

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
    </Container>
  );
}

export default AdminPage;
