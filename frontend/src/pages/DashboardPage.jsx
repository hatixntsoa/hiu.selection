import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Alert, Form, Button } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import Scoreboard from '../components/Dashboard/Scoreboard';
import ChallengeList from '../components/Challenges/ChallengeList';
import LiveFeed from '../components/Dashboard/LiveFeed';

function DashboardPage() {
  const { user, updateUser } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [scoreboard, setScoreboard] = useState([]);
  const [activity, setActivity] = useState([]);
  const [solvedChallenges, setSolvedChallenges] = useState(new Set());
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [flagInput, setFlagInput] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const [challengesRes, scoreboardRes, activityRes, historyRes] = await Promise.all([
        api.get('/challenges'),
        api.get('/scoreboard'),
        api.get('/scoreboard/activity'),
        api.get('/flags/history')
      ]);

      setChallenges(challengesRes.data.challenges);
      setScoreboard(scoreboardRes.data.scoreboard);
      setActivity(activityRes.data.activities);
      
      const solved = new Set(
        historyRes.data.submissions
          .filter(s => s.is_correct)
          .map(s => s.challenge_id)
      );
      setSolvedChallenges(solved);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = connectSocket();
    
    socket.on('flag_captured', (data) => {
      setActivity(prev => [data, ...prev.slice(0, 19)]);
    });

    socket.on('scoreboard_update', () => {
      fetchData();
    });

    return () => {
      socket.off('flag_captured');
      socket.off('scoreboard_update');
    };
  }, []);

  const handleSubmitFlag = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!selectedChallenge || !flagInput) {
      setError('Please select a challenge and enter a flag');
      return;
    }

    try {
      const response = await api.post('/flags/submit', {
        challengeId: selectedChallenge,
        flag: flagInput
      });

      setResult(response.data);
      
      if (response.data.correct) {
        setSolvedChallenges(prev => new Set([...prev, selectedChallenge]));
        setFlagInput('');
        updateUser({ score: user.score + response.data.points });
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit flag');
    }
  };

  const totalPoints = challenges.reduce((sum, c) => sum + c.points, 0);
  const solvedPoints = challenges
    .filter(c => solvedChallenges.has(c.id))
    .reduce((sum, c) => sum + c.points, 0);

  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h2>Dashboard</h2>
          <p className="text-secondary">Welcome back, {user?.name}!</p>
        </Col>
      </Row>

      <Row className="g-4 mb-4">
        <Col md={3}>
          <Card>
            <Card.Body className="text-center">
              <h1 className="text-primary">{user?.score || 0}</h1>
              <p className="text-secondary mb-0">Your Points</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card>
            <Card.Body className="text-center">
              <h1 className="text-success">{solvedChallenges.size}</h1>
              <p className="text-secondary mb-0">Challenges Solved</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card>
            <Card.Body className="text-center">
              <h1 className="text-warning">{solvedPoints}/{totalPoints}</h1>
              <p className="text-secondary mb-0">Points Progress</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card>
            <Card.Body className="text-center">
              <h1 className="text-info">
                {scoreboard.findIndex(t => t.id === user?.id) + 1 || '-'}
              </h1>
              <p className="text-secondary mb-0">Your Rank</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={8}>
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">🚩 Challenges</h5>
            </Card.Header>
            <Card.Body>
              <ChallengeList
                challenges={challenges}
                solvedChallenges={solvedChallenges}
                onSelectChallenge={(id) => setSelectedChallenge(id)}
                selectedChallenge={selectedChallenge}
              />
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h5 className="mb-0">⌨️ Submit Flag</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmitFlag}>
                <Form.Group className="mb-3">
                  <Form.Label>Challenge</Form.Label>
                  <Form.Control
                    as="select"
                    value={selectedChallenge || ''}
                    onChange={(e) => setSelectedChallenge(Number(e.target.value))}
                  >
                    <option value="">Select a challenge...</option>
                    {challenges.map(c => (
                      <option key={c.id} value={c.id} disabled={solvedChallenges.has(c.id)}>
                        {c.title} - {c.points} pts {solvedChallenges.has(c.id) ? '(Solved)' : ''}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Flag</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="flag{...}"
                    value={flagInput}
                    onChange={(e) => setFlagInput(e.target.value)}
                  />
                </Form.Group>
                <Button variant="primary" type="submit">
                  Submit Flag
                </Button>
              </Form>

              {result && (
                <Alert variant={result.correct ? 'success' : 'danger'} className="mt-3">
                  {result.message} {result.correct && `+${result.points} points!`}
                </Alert>
              )}
              {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">
                <span className="live-indicator text-success">●</span> Scoreboard
              </h5>
            </Card.Header>
            <Card.Body>
              <Scoreboard scoreboard={scoreboard} currentUserId={user?.id} />
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h5 className="mb-0">📡 Live Activity</h5>
            </Card.Header>
            <Card.Body>
              <LiveFeed activity={activity} />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default DashboardPage;
