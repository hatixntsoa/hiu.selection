import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function HomePage() {
  const { user } = useAuth();

  return (
    <Container>
      <Row className="justify-content-center text-center mb-5">
        <Col lg={8}>
          <h1 className="display-4 fw-bold mb-4">
            Welcome to <span className="text-primary">CTF Platform</span>
          </h1>
          <p className="lead text-secondary mb-4">
            Test your skills in cybersecurity challenges. Capture flags, earn points, and climb the leaderboard!
          </p>
          {!user ? (
            <div className="d-flex gap-3 justify-content-center">
              <Button as={Link} to="/login" variant="primary" size="lg">
                Login to Play
              </Button>
              <Button as={Link} to="/login" variant="outline-primary" size="lg">
                Register Team
              </Button>
            </div>
          ) : (
            <Button as={Link} to="/dashboard" variant="primary" size="lg">
              Go to Dashboard
            </Button>
          )}
        </Col>
      </Row>

      <Row className="g-4 mt-4">
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="text-primary">🚩 Capture Flags</Card.Title>
              <Card.Text className="text-secondary">
                Solve challenges by finding and submitting flags. Each challenge awards points based on difficulty.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="text-success">📊 Live Scoring</Card.Title>
              <Card.Text className="text-secondary">
                Watch the scoreboard update in real-time as teams solve challenges. Track your progress live!
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="text-warning">🏆 Compete</Card.Title>
              <Card.Text className="text-secondary">
                Race against other teams to solve challenges first. First blood gets bonus recognition!
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mt-5">
        <Col>
          <Card>
            <Card.Header>
              <h5 className="mb-0">📋 Rules</h5>
            </Card.Header>
            <Card.Body>
              <ul className="mb-0">
                <li>Each team can have multiple members, but only one submission per challenge</li>
                <li>Flags are case-insensitive and follow the format: flag{"{...}"}</li>
                <li>Points are awarded based on challenge difficulty</li>
                <li>No cheating, brute forcing other teams' accounts, or attacking the platform</li>
                <li>Have fun and learn something new!</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default HomePage;
