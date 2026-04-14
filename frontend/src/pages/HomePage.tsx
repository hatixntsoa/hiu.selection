import { Button, Card, Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function HomePage(): JSX.Element {
  const { user } = useAuth();

  return (
    <Container>
      <Row className="justify-content-center text-center mb-5">
        <Col lg={8}>
          <h1 className="display-4 fw-bold mb-4">
            Welcome to <span className="text-primary">CTF Platform</span>
          </h1>
          <p className="lead text-secondary mb-4">
            Test your skills in cybersecurity challenges. Capture flags, earn points, and climb the leaderboard.
          </p>
          {!user ? (
            <div className="d-flex gap-3 justify-content-center">
              <Link className="btn btn-primary btn-lg" to="/login">
                Login to Play
              </Link>
              <Link className="btn btn-outline-primary btn-lg" to="/login">
                Register Team
              </Link>
            </div>
          ) : (
            <Link className="btn btn-primary btn-lg" to="/dashboard">
              Go to Dashboard
            </Link>
          )}
        </Col>
      </Row>

      <Row className="g-4 mt-4">
        <Col md={4}>
          <Card className="h-100 soft-card">
            <Card.Body>
              <Card.Title className="text-primary">Capture Flags</Card.Title>
              <Card.Text className="text-secondary">
                Solve challenges by finding and submitting flags. Each challenge awards points based on difficulty.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100 soft-card">
            <Card.Body>
              <Card.Title className="text-success">Live Scoring</Card.Title>
              <Card.Text className="text-secondary">
                Watch the scoreboard update in real-time as teams solve challenges and track your progress.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100 soft-card">
            <Card.Body>
              <Card.Title className="text-warning">Compete</Card.Title>
              <Card.Text className="text-secondary">
                Race against other teams to solve challenges first and secure your place on the leaderboard.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mt-5">
        <Col>
          <Card className="soft-card">
            <Card.Header>
              <h5 className="mb-0">Rules</h5>
            </Card.Header>
            <Card.Body>
              <ul className="mb-0">
                <li>Each team can have multiple members, but only one submission per challenge.</li>
                <li>Flags are case-insensitive and follow the format: flag{'{...}'}.</li>
                <li>Points are awarded based on challenge difficulty.</li>
                <li>No cheating, brute-forcing accounts, or attacking the platform.</li>
                <li>Have fun and learn something new.</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default HomePage;
