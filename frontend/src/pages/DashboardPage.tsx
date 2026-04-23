import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Container, Form, Modal, Row } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import api from '../services/api';
import { notify } from '../services/notifications';
import Scoreboard from '../components/Dashboard/Scoreboard';
import LiveFeed from '../components/Dashboard/LiveFeed';
import { ActivityItem, Challenge, CtfTimerState, ScoreboardTeam, SubmissionHistoryItem } from '../types';

type DashboardSection = 'ranking' | 'live-activity' | 'submission' | 'challenges';
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

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
    const allowed: DashboardSection[] = ['ranking', 'live-activity', 'submission', 'challenges'];
    return allowed.includes(section as DashboardSection) ? (section as DashboardSection) : 'ranking';
  }, [section]);

  const { user, updateUser } = useAuth();
  const { t } = usePreferences();
  const [allFlags, setAllFlags] = useState<Challenge[]>([]);
  const [challengeFlags, setChallengeFlags] = useState<Challenge[]>([]);
  const [scoreboard, setScoreboard] = useState<ScoreboardTeam[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [solvedChallenges, setSolvedChallenges] = useState<Set<number>>(new Set());
  const [vmFlagInput, setVmFlagInput] = useState('');
  const [challengeFlagInput, setChallengeFlagInput] = useState('');
  const [timer, setTimer] = useState<CtfTimerState | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [showSolveModal, setShowSolveModal] = useState(false);

  const fetchData = async (): Promise<void> => {
    try {
      const [allFlagsRes, challengesRes, scoreboardRes, activityRes, historyRes, timerRes] = await Promise.all([
        api.get('/challenges'),
        api.get('/challenges?type=challenge'),
        api.get('/scoreboard'),
        api.get('/scoreboard/activity'),
        api.get('/flags/history'),
        api.get('/scoreboard/timer')
      ]);

      setAllFlags(allFlagsRes.data.challenges as Challenge[]);
      setChallengeFlags(challengesRes.data.challenges as Challenge[]);
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
    void fetchData();

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

  const handleSubmitVmFlag = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (timer && !timer.canSubmit) {
      notify('error', t('timerSubmissionsClosed'));
      return;
    }

    if (!vmFlagInput) {
      notify('error', t('dashboardNeedFlagOnly'));
      return;
    }

    try {
      const response = await api.post('/flags/submit', { flag: vmFlagInput });
      if ((response.data as { correct?: boolean }).correct) {
        setVmFlagInput('');
        updateUser({ score: (user?.score || 0) + Number((response.data as { points?: number }).points || 0) });
        await celebrateSolve();
        void fetchData();
      }
    } catch (err: any) {
      if (!err?.response?.data?.error) {
        notify('error', t('dashboardSubmitFailed'));
      }
    }
  };

  const openSolveModal = (challenge: Challenge): void => {
    setSelectedChallenge(challenge);
    setChallengeFlagInput('');
    setShowSolveModal(true);
  };

  const handleSubmitChallengeFlag = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (timer && !timer.canSubmit) {
      notify('error', t('timerSubmissionsClosed'));
      return;
    }
    if (!selectedChallenge || !challengeFlagInput) {
      notify('error', t('dashboardNeedFlagOnly'));
      return;
    }
    if (solvedChallenges.has(selectedChallenge.id)) {
      notify('error', t('apiAlreadySolved'));
      return;
    }

    try {
      const response = await api.post('/flags/submit', { flag: challengeFlagInput });
      if ((response.data as { correct?: boolean }).correct) {
        setChallengeFlagInput('');
        setShowSolveModal(false);
        setSolvedChallenges((prev) => {
          const next = new Set(prev);
          next.add(selectedChallenge.id);
          return next;
        });
        updateUser({ score: (user?.score || 0) + Number((response.data as { points?: number }).points || 0) });
        await celebrateSolve();
        void fetchData();
      }
    } catch (err: any) {
      if (!err?.response?.data?.error) {
        notify('error', t('dashboardSubmitFailed'));
      }
    }
  };

  const totalPoints = allFlags.reduce((sum, c) => sum + Number(c.first_blood_points || 100), 0);
  const solvedPoints = allFlags
    .filter((c) => solvedChallenges.has(c.id))
    .reduce((sum, c) => sum + Number(c.default_points || 50), 0);
  const currentTeamRank = scoreboard.find((team) => team.id === user?.id)?.rank ?? null;
  const challengesDisabled = Boolean(timer && !timer.canSubmit);
  const challengeDisabledMessage = timer && !timer.isActive ? t('dashboardChallengesNotStarted') : t('dashboardChallengesClosed');

  const categoryLabel = (value: string | undefined): string => {
    const key = String(value || '').toLowerCase();
    if (key === 'crypto') {
      return t('challengeCategoryCrypto');
    }
    if (key === 'forensics') {
      return t('challengeCategoryForensics');
    }
    if (key === 'reverse') {
      return t('challengeCategoryReverse');
    }
    if (key === 'pwn') {
      return t('challengeCategoryPwn');
    }
    if (key === 'osint') {
      return t('challengeCategoryOsint');
    }
    return t('challengeCategoryVM');
  };

  const categoryBadgeVariant = (value: string | undefined): string => {
    const key = String(value || '').toLowerCase();
    if (key === 'crypto') {
      return 'warning';
    }
    if (key === 'forensics') {
      return 'secondary';
    }
    if (key === 'reverse') {
      return 'danger';
    }
    if (key === 'pwn') {
      return 'dark';
    }
    if (key === 'osint') {
      return 'info';
    }
    return 'primary';
  };

  const difficultyLabel = (value: string | undefined): string => {
    if (value === 'medium') {
      return t('difficultyMedium');
    }
    if (value === 'hard') {
      return t('difficultyHard');
    }
    return t('difficultyEasy');
  };

  const difficultyBadgeVariant = (value: string | undefined): string => {
    if (value === 'medium') {
      return 'warning';
    }
    if (value === 'hard') {
      return 'danger';
    }
    return 'success';
  };

  const challengeCardPoints = (challenge: Challenge): number => {
    return Math.max(
      Number(challenge.first_blood_points) || 0,
      Number(challenge.second_blood_points) || 0,
      Number(challenge.default_points) || 0
    );
  };

  const renderFormattedText = (text?: string): JSX.Element => {
    const normalized = String(text || '-').replace(/\\n/g, '\n');
    const lines = normalized.split('\n');

    return (
      <span className="challenge-rich-text">
        {lines.map((line, lineIndex) => {
          const parts = line.split(URL_REGEX);
          return (
            <span key={`line-${lineIndex}`}>
              {parts.map((part, partIndex) =>
                /^https?:\/\/\S+$/i.test(part) ? (
                  <a key={`part-${lineIndex}-${partIndex}`} href={part} target="_blank" rel="noreferrer">
                    {part}
                  </a>
                ) : (
                  <span key={`part-${lineIndex}-${partIndex}`}>{part}</span>
                )
              )}
              {lineIndex < lines.length - 1 ? <br /> : null}
            </span>
          );
        })}
      </span>
    );
  };

  const groupedChallenges = useMemo(() => {
    const groups: Record<'easy' | 'medium' | 'hard', Challenge[]> = {
      easy: [],
      medium: [],
      hard: []
    };
    challengeFlags.forEach((challenge) => {
      const key = challenge.difficulty === 'medium' || challenge.difficulty === 'hard' ? challenge.difficulty : 'easy';
      groups[key].push(challenge);
    });
    return (['easy', 'medium', 'hard'] as const)
      .map((difficulty) => ({ difficulty, items: groups[difficulty] }))
      .filter((group) => group.items.length > 0);
  }, [challengeFlags]);

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

      {currentSection === 'challenges' && (
        <Card className="soft-card mt-1">
          <Card.Header>
            <h5 className="mb-0 section-title">{t('dashboardChallenges')}</h5>
          </Card.Header>
          <Card.Body>
            {challengesDisabled && <Alert variant={timer?.isActive ? 'danger' : 'secondary'} className="mb-3">{challengeDisabledMessage}</Alert>}
            {groupedChallenges.map((group) => (
              <div key={group.difficulty} className="challenge-difficulty-group">
                <h6 className="challenge-group-title mb-3">{difficultyLabel(group.difficulty)}</h6>
                <Row className="g-4">
                  {group.items.map((challenge) => {
                    const isSolved = solvedChallenges.has(challenge.id);
                    const canOpenSolveModal = !challengesDisabled;
                    return (
                    <Col key={challenge.id} md={6} xl={4}>
                      <Card
                        className={`challenge-card h-100 soft-card ${isSolved ? 'challenge-card-solved' : ''}`}
                        onClick={() => {
                          if (canOpenSolveModal) {
                            openSolveModal(challenge);
                          }
                        }}
                        style={{ cursor: canOpenSolveModal ? 'pointer' : 'default' }}
                      >
                        <Card.Body className="d-flex flex-column">
                          <div className="d-flex justify-content-between align-items-start">
                            <Card.Title className="h5 mb-0">{challenge.title}</Card.Title>
                            <div className="d-flex flex-column align-items-end">
                              <Badge pill bg="primary">
                                {challengeCardPoints(challenge)} {t('scoreboardPoints').toLowerCase()}
                              </Badge>
                            </div>
                          </div>
                          <div className="d-flex challenge-card-badges">
                            <Badge pill bg={difficultyBadgeVariant(challenge.difficulty)}>
                              {difficultyLabel(challenge.difficulty)}
                            </Badge>
                            <Badge pill bg={categoryBadgeVariant(challenge.category)}>
                              {categoryLabel(challenge.category)}
                            </Badge>
                          </div>
                          <Card.Text className="text-secondary">{challenge.description || '-'}</Card.Text>
                          <div className="mt-auto pt-2 d-flex justify-content-between align-items-center">
                            <Button
                              variant={isSolved ? 'success' : 'primary'}
                              className={isSolved ? 'challenge-solved-btn' : undefined}
                              onClick={(event) => {
                                event.stopPropagation();
                                openSolveModal(challenge);
                              }}
                              disabled={challengesDisabled}
                            >
                              {isSolved ? t('challengesSolved') : t('challengeSolve')}
                            </Button>
                            {isSolved && <span className="challenge-solved-mark">✓</span>}
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  );
                  })}
                </Row>
              </div>
            ))}
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
            <Form onSubmit={handleSubmitVmFlag}>
              <Form.Group className="mb-3">
                <Form.Label>{t('dashboardFlagLabel')}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="HIU_2026{...}"
                  value={vmFlagInput}
                  onChange={(e) => setVmFlagInput(e.target.value)}
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

      <Modal show={showSolveModal} onHide={() => setShowSolveModal(false)} centered className="challenge-solve-modal">
        <Form onSubmit={handleSubmitChallengeFlag}>
          <Modal.Header closeButton>
            <Modal.Title>{selectedChallenge?.title || t('dashboardChallenges')}</Modal.Title>
          </Modal.Header>
          <Modal.Body className="challenge-solve-modal-body">
            <p className="mb-2 text-secondary">{renderFormattedText(selectedChallenge?.description)}</p>
            <p className="mb-3">
              <strong>{t('dashboardProblemFormulation')}:</strong> {renderFormattedText(selectedChallenge?.problem_formulation)}
            </p>
            <Form.Group>
              <Form.Label>{t('dashboardFlagLabel')}</Form.Label>
              <Form.Control
                type="text"
                placeholder="HIU_2026{...}"
                value={challengeFlagInput}
                onChange={(e) => setChallengeFlagInput(e.target.value)}
                disabled={challengesDisabled || Boolean(selectedChallenge && solvedChallenges.has(selectedChallenge.id))}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowSolveModal(false)}>
              {t('managerCancel')}
            </Button>
            <Button variant="primary" type="submit" disabled={challengesDisabled}>
              {t('challengeSolve')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default DashboardPage;
