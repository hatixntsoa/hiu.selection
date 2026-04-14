import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Modal, Row } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import Scoreboard from '../components/Dashboard/Scoreboard';
import ScoreboardCharts from '../components/Dashboard/ScoreboardCharts';
import ChallengeList from '../components/Challenges/ChallengeList';
import LiveFeed from '../components/Dashboard/LiveFeed';
import { ActivityItem, Challenge, CtfTimerState, ScoreboardTeam, SubmissionHistoryItem } from '../types';

type FlagResult = {
  correct: boolean;
  message: string;
  points: number;
};

type DashboardSection = 'ranking' | 'scoreboard' | 'live-activity' | 'challenges';

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
  const totalDuration = 2000;
  const streamEndTime = startedAt + 850;

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
    const allowed: DashboardSection[] = ['ranking', 'scoreboard', 'live-activity', 'challenges'];
    return allowed.includes(section as DashboardSection) ? (section as DashboardSection) : 'ranking';
  }, [section]);

  const { user, updateUser } = useAuth();
  const { t, localizeApiMessage } = usePreferences();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [scoreboard, setScoreboard] = useState<ScoreboardTeam[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [solvedChallenges, setSolvedChallenges] = useState<Set<number>>(new Set());
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [flagInput, setFlagInput] = useState('');
  const [result, setResult] = useState<FlagResult | null>(null);
  const [error, setError] = useState('');
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

    const socket = connectSocket();
    socket.on('flag_captured', (data: ActivityItem) => {
      setActivity((prev) => [data, ...prev.slice(0, 19)]);
    });
    socket.on('scoreboard_update', () => {
      fetchData();
    });

    return () => {
      socket.off('flag_captured');
      socket.off('scoreboard_update');
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

  const openChallengeModal = (challenge: Challenge): void => {
    setActiveChallenge(challenge);
    setShowSubmitModal(true);
    setFlagInput('');
    setResult(null);
    setError('');
  };

  const handleSubmitFlag = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (timer && !timer.canSubmit) {
      setError(t('timerSubmissionsClosed'));
      return;
    }

    if (!activeChallenge || !flagInput) {
      setError(t('dashboardNeedChallengeAndFlag'));
      return;
    }

    try {
      const response = await api.post('/flags/submit', {
        challengeId: activeChallenge.id,
        flag: flagInput
      });

      const responseResult = response.data as FlagResult;
      setResult(responseResult);

      if (responseResult.correct) {
        setSolvedChallenges((prev) => new Set([...prev, activeChallenge.id]));
        setFlagInput('');
        updateUser({ score: (user?.score || 0) + responseResult.points });
        await celebrateSolve();
        fetchData();
      }
    } catch (err: any) {
      setError(localizeApiMessage(err.response?.data?.error || t('dashboardSubmitFailed')));
    }
  };

  const totalPoints = challenges.reduce((sum, c) => sum + c.points, 0);
  const solvedPoints = challenges.filter((c) => solvedChallenges.has(c.id)).reduce((sum, c) => sum + c.points, 0);
  const rank = scoreboard.findIndex((team) => team.id === user?.id) + 1;
  const activeSolved = activeChallenge ? solvedChallenges.has(activeChallenge.id) : false;
  const challengesDisabled = Boolean(timer && !timer.canSubmit);
  const timerLabel = timer?.isInfinite
    ? t('timerInfinite')
    : typeof timer?.timeLeftSeconds === 'number'
      ? new Date(timer.timeLeftSeconds * 1000).toISOString().substring(11, 19)
      : timer?.canSubmit
        ? t('timerNotStarted')
        : t('timerFinished');

  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h2 className="section-title">{t('dashboardTitle')}</h2>
          <p className="text-secondary">{t('dashboardWelcomeBack', { name: user?.name || '' })}</p>
        </Col>
        <Col lg="auto" className="d-flex align-items-center">
          <Card className="soft-card px-3 py-2">
            <small className="text-secondary d-block">{t('timerLabel')}</small>
            <strong className={challengesDisabled ? 'text-danger' : 'text-success'}>{timerLabel}</strong>
          </Card>
        </Col>
      </Row>

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
                <h1 className="text-info">{rank || '-'}</h1>
                <p className="text-secondary mb-0">{t('dashboardRank')}</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {currentSection === 'scoreboard' && (
        <>
          <Card className="soft-card mt-1">
            <Card.Header>
              <h5 className="mb-0">
                <span className="live-indicator text-success">●</span> {t('dashboardScoreboard')}
              </h5>
            </Card.Header>
            <Card.Body>
              <Scoreboard scoreboard={scoreboard} currentUserId={user?.id} />
            </Card.Body>
          </Card>
          <ScoreboardCharts challenges={challenges} solvedChallenges={solvedChallenges} userScore={user?.score || 0} />
        </>
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

      {currentSection === 'challenges' && (
        <Card className="soft-card mt-1">
          <Card.Header>
            <h5 className="mb-0 section-title">{t('dashboardChallenges')}</h5>
          </Card.Header>
          <Card.Body>
            {challengesDisabled && (
              <Alert variant="danger" className="mb-3">
                {t('dashboardChallengesClosed')}
              </Alert>
            )}
            <ChallengeList
              challenges={challenges}
              solvedChallenges={solvedChallenges}
              onOpenChallenge={openChallengeModal}
              activeChallengeId={activeChallenge?.id || null}
              disabled={challengesDisabled}
            />
          </Card.Body>
        </Card>
      )}

      <Modal show={showSubmitModal} onHide={() => setShowSubmitModal(false)} centered>
        <Form onSubmit={handleSubmitFlag}>
          <Modal.Header closeButton>
            <Modal.Title>{activeChallenge?.title || t('dashboardSubmitFlag')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {activeChallenge && (
              <>
                <p className="text-secondary mb-2">{activeChallenge.description}</p>
                <p className="mb-3">
                  <strong>{activeChallenge.points}</strong> {t('scoreboardPoints').toLowerCase()}
                </p>
              </>
            )}
            <Form.Group className="mb-3">
              <Form.Label>{t('dashboardFlagLabel')}</Form.Label>
              <Form.Control
                type="text"
                placeholder="flag{...}"
                value={flagInput}
                onChange={(e) => setFlagInput(e.target.value)}
                disabled={activeSolved || challengesDisabled}
              />
            </Form.Group>

            {result && (
              <Alert variant={result.correct ? 'success' : 'danger'} className="mt-2 mb-0">
                {localizeApiMessage(result.message)} {result.correct && `+${result.points} ${t('scoreboardPoints').toLowerCase()}!`}
              </Alert>
            )}
            {error && (
              <Alert variant="danger" className="mt-2 mb-0">
                {error}
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowSubmitModal(false)}>
              {t('managerCancel')}
            </Button>
             <Button variant="primary" type="submit" disabled={activeSolved || challengesDisabled}>
               {activeSolved ? t('challengesSolved') : t('dashboardSubmitButton')}
             </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default DashboardPage;
