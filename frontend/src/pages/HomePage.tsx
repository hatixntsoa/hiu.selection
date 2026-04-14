import { Card, Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';

function HomePage(): JSX.Element {
  const { user } = useAuth();
  const { t } = usePreferences();

  return (
    <Container>
      <Row className="justify-content-center text-center mb-5">
        <Col lg={8}>
          <h1 className="display-4 fw-bold mb-4">
            {t('homeWelcome')} <span className="text-primary">HIU Selection</span>
          </h1>
          <p className="lead text-secondary mb-4">{t('homeIntro')}</p>
          {!user ? (
            <div className="d-flex gap-3 justify-content-center">
              <Link className="btn btn-primary btn-lg" to="/auth?tab=login">
                {t('homeLoginToPlay')}
              </Link>
              <Link className="btn btn-outline-primary btn-lg" to="/auth?tab=register">
                {t('homeRegisterTeam')}
              </Link>
            </div>
          ) : (
            <Link className="btn btn-primary btn-lg" to="/dashboard/scoreboard">
              {t('homeGoToDashboard')}
            </Link>
          )}
        </Col>
      </Row>

      <Row className="g-4 mt-4">
        <Col md={4}>
            <Card className="h-100 soft-card">
              <Card.Body>
                <Card.Title className="text-primary">{t('homeCaptureFlagsTitle')}</Card.Title>
                <Card.Text className="text-secondary">{t('homeCaptureFlagsDesc')}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 soft-card">
              <Card.Body>
                <Card.Title className="text-success">{t('homeLiveScoringTitle')}</Card.Title>
                <Card.Text className="text-secondary">{t('homeLiveScoringDesc')}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 soft-card">
              <Card.Body>
                <Card.Title className="text-warning">{t('homeCompeteTitle')}</Card.Title>
                <Card.Text className="text-secondary">{t('homeCompeteDesc')}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
      </Row>

      <Row className="mt-5">
        <Col>
            <Card className="soft-card">
              <Card.Header>
                <h5 className="mb-0">{t('homeRules')}</h5>
              </Card.Header>
              <Card.Body>
                <ul className="mb-0">
                  <li>{t('homeRule1')}</li>
                  <li>{t('homeRule2')}</li>
                  <li>{t('homeRule3')}</li>
                  <li>{t('homeRule4')}</li>
                  <li>{t('homeRule5')}</li>
                </ul>
              </Card.Body>
            </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default HomePage;
