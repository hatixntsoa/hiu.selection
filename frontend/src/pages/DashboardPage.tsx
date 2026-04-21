import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import api from '../services/api';
import { notify } from '../services/notifications';
import Scoreboard from '../components/Dashboard/Scoreboard';
import LiveFeed from '../components/Dashboard/LiveFeed';
import { ActivityItem, Challenge, CtfTimerState, ScoreboardTeam, SubmissionHistoryItem } from '../types';

type DashboardSection = 'ranking' | 'live-activity' | 'submission';

async function celebrateSolve(): Promise<void> {
  const { default: confetti } = await import('canvas-confetti');
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '99999';
  document.body.appendChild(canvas);

  const fire = confetti.create(canvas, { resize: true, useWorker: true });
  const startedAt = Date.now();
  const totalDuration = 6800;
  const streamEndTime = startedAt + 1900;

  fire({
    particleCount: 220,
    spread: 140,
    startVelocity: 42,
    gravity: 0.85,
    ticks: 420,
    scalar: 0.95,
    origin: { x: 0.5, y: 0.5 }
  });
  fire({
    particleCount: 100,
    angle: 55,
    spread: 70,
    startVelocity: 38,
    gravity: 0.9,
    ticks: 420,
    origin: { x: 0, y: 0.55 }
  });
  fire({
    particleCount: 100,
    angle: 125,
    spread: 70,
    startVelocity: 38,
    gravity: 0.9,
    ticks: 420,
    origin: { x: 1, y: 0.55 }
  });

  const frame = (): void => {
    fire({
      particleCount: 6,
      angle: 90,
      spread: 125,
      startVelocity: 32,
      gravity: 0.95,
      ticks: 430,
      scalar: 0.95,
      origin: { x: Math.random(), y: -0.02 }
    });

    if (Date.now() < streamEndTime) {
      requestAnimationFrame(frame);
      return;
    }

    const remainingMs = Math.max(0, totalDuration - (Date.now() - startedAt));
    setTimeout(() => {
      canvas.remove();
    }, remainingMs);
  };

  frame();
}

function DashboardPage(): JSX.Element {
  const { section } = useParams<{ section: string }>();
  const currentSection: DashboardSection = useMemo(() => {
    const allowed: DashboardSection[] = ['ranking', 'live-activity', 'submission'];
    return allowed.includes(section as DashboardSection) ? (section as DashboardSection) : 'ranking';
  }, [section]);

  const { user, updateUser } = useAuth();
  const { t } = usePreferences();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [scoreboard, setScoreboard] = useState<ScoreboardTeam[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [solvedChallenges, setSolvedChallenges] = useState<Set<number>>(new Set());
  const [flagInput, setFlagInput] = useState('');
  const [timer, setTimer] = useState<CtfTimerState | null>(null);

  const fetchData = async (): Promise<void> => {
    try {
      const [challengesRes, scoreboardRes, activityRes, historyRes, timerRes] = await Promise.all([
        api.get('/challenges'),
        api.get('/scoreboard'),
        api.get('/scoreboard/activity'),
        api.get('/flags/history'),
        api.get('/scoreboard/timer')
      ]);

      setChallenges(challengesRes.data.challenges as Challenge[]);
      setScoreboard(scoreboardRes.data.scoreboard as ScoreboardTeam[]);
      setActivity(activityRes.data.activities as ActivityItem[]);

      const solved = new Set(
        (historyRes.data.submissions as SubmissionHistoryItem[])
          .filter((s) => s.is_correct)
          .map((s) => s.challenge_id)
      );
      setSolvedChallenges(solved);
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
      const onFlagCaptured = (data: ActivityItem): void => {
        setActivity((prev) => [data, ...prev.slice(0, 19)]);
      };
      const onScoreboardUpdate = (): void => {
        void fetchData();
      };
      socket.on('flag_captured', onFlagCaptured);
      socket.on('scoreboard_update', onScoreboardUpdate);
      cleanup = () => {
        socket.off('flag_captured', onFlagCaptured);
        socket.off('scoreboard_update', onScoreboardUpdate);
      };
    };
    void setupSocket();

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      api
        .get('/scoreboard/timer')
        .then((response) => setTimer(response.data.timer as CtfTimerState))
        .catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleSubmitFlag = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (timer && !timer.canSubmit) {
      notify('error', t('timerSubmissionsClosed'));
      return;
    }

    if (!flagInput) {
      notify('error', t('dashboardNeedFlagOnly'));
      return;
    }

    try {
      const response = await api.post('/flags/submit', {
        flag: flagInput
      });
      if ((response.data as { correct?: boolean }).correct) {
        setFlagInput('');
        updateUser({ score: (user?.score || 0) + Number((response.data as { points?: number }).points || 0) });
        await celebrateSolve();
        fetchData();
      }
    } catch (err: any) {
      if (!err?.response?.data?.error) {
        notify('error', t('dashboardSubmitFailed'));
      }
    }
  };

  const totalPoints = challenges.reduce((sum, c) => sum + Number(c.first_blood_points || 100), 0);
  const solvedPoints = challenges
    .filter((c) => solvedChallenges.has(c.id))
    .reduce((sum, c) => sum + Number(c.default_points || 50), 0);
  const currentTeamRank = scoreboard.find((team) => team.id === user?.id)?.rank ?? null;
  const challengesDisabled = Boolean(timer && !timer.canSubmit);
  const challengeDisabledMessage = timer && !timer.isActive ? t('dashboardChallengesNotStarted') : t('dashboardChallengesClosed');
  return (
    <Container fluid>
      {currentSection === 'ranking' && (
        <Row className="g-4 mt-1">
          <Col md={3}>
            <Card className="soft-card">
              <Card.Body className="text-center">
                <h1 className="text-primary">{user?.score || 0}</h1>
                <p className="text-secondary mb-0">{t('dashboardYourPoints')}</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="soft-card">
              <Card.Body className="text-center">
                <h1 className="text-success">{solvedChallenges.size}</h1>
                <p className="text-secondary mb-0">{t('dashboardSolved')}</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="soft-card">
              <Card.Body className="text-center">
                <h1 className="text-warning">
                  {solvedPoints}/{totalPoints}
                </h1>
                <p className="text-secondary mb-0">{t('dashboardProgress')}</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="soft-card">
              <Card.Body className="text-center">
                <h1 className="text-info">{currentTeamRank ?? '-'}</h1>
                <p className="text-secondary mb-0">{t('dashboardRank')}</p>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={12}>
            <Card className="soft-card">
              <Card.Header>
                <h5 className="mb-0">{t('dashboardScoreboard')}</h5>
              </Card.Header>
              <Card.Body style={{ maxHeight: '560px', overflowY: 'auto' }}>
                <Scoreboard scoreboard={scoreboard} currentUserId={user?.id} />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {currentSection === 'live-activity' && (
        <Card className="soft-card mt-1">
          <Card.Header>
            <h5 className="mb-0">{t('dashboardLiveActivity')}</h5>
          </Card.Header>
          <Card.Body>
            <LiveFeed activity={activity} />
          </Card.Body>
        </Card>
      )}

      {currentSection === 'submission' && (
        <Card className="soft-card mt-1">
          <Card.Header>
            <h5 className="mb-0 section-title">{t('dashboardSubmission')}</h5>
          </Card.Header>
          <Card.Body>
            {challengesDisabled && <Alert variant={timer?.isActive ? 'danger' : 'secondary'} className="mb-3">{challengeDisabledMessage}</Alert>}
            <Form onSubmit={handleSubmitFlag}>
              <Form.Group className="mb-3">
                <Form.Label>{t('dashboardFlagLabel')}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="HIU_2026{...}"
                  value={flagInput}
                  onChange={(e) => setFlagInput(e.target.value)}
                  disabled={challengesDisabled}
                />
              </Form.Group>
              <div className="mt-3">
                <Button variant="primary" type="submit" disabled={challengesDisabled}>
                  {t('dashboardSubmitButton')}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}

export default DashboardPage;
