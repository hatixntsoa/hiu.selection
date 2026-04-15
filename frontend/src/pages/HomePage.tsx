import { CSSProperties, useEffect, useState } from 'react';
import { Card, Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';

function HomePage(): JSX.Element {
  const { user } = useAuth();
  const { t } = usePreferences();
  const [showInitialSkeleton, setShowInitialSkeleton] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem('home-skeleton-shown') !== 'true';
  });

  useEffect(() => {
    if (!showInitialSkeleton) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setShowInitialSkeleton(false);
      localStorage.setItem('home-skeleton-shown', 'true');
    }, 950);

    return () => window.clearTimeout(timeout);
  }, [showInitialSkeleton]);

  useEffect(() => {
    if (showInitialSkeleton) {
      return undefined;
    }

    const items = Array.from(document.querySelectorAll<HTMLElement>('.home-reveal'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.18 }
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [showInitialSkeleton]);

  const topCards = [
    { title: t('homeCaptureFlagsTitle'), desc: t('homeCaptureFlagsDesc'), color: 'text-primary', icon: '⌁' },
    { title: t('homeLiveScoringTitle'), desc: t('homeLiveScoringDesc'), color: 'text-success', icon: '◉' },
    { title: t('homeCompeteTitle'), desc: t('homeCompeteDesc'), color: 'text-warning', icon: '▲' }
  ];

  const detailCards = [
    { title: t('homeCardTypesTitle'), desc: t('homeCardTypesDesc'), color: 'text-primary', icon: '◌' },
    { title: t('homeCardPointsTitle'), desc: t('homeCardPointsDesc'), color: 'text-success', icon: '✦' },
    { title: t('homeCardTimerTitle'), desc: t('homeCardTimerDesc'), color: 'text-warning', icon: '◷' },
    { title: t('homeCardRealtimeTitle'), desc: t('homeCardRealtimeDesc'), color: 'text-info', icon: '↻' },
    { title: t('homeCardAdminTitle'), desc: t('homeCardAdminDesc'), color: 'text-primary', icon: '⚙' },
    { title: t('homeCardTeamTitle'), desc: t('homeCardTeamDesc'), color: 'text-success', icon: '◍' },
    { title: t('homeCardSecurityTitle'), desc: t('homeCardSecurityDesc'), color: 'text-warning', icon: '⛨' },
    { title: t('homeCardUxTitle'), desc: t('homeCardUxDesc'), color: 'text-info', icon: '◈' },
    { title: t('homeCardFlowTitle'), desc: t('homeCardFlowDesc'), color: 'text-primary', icon: '➜' }
  ];

  const extraCards = [
    { title: t('homeExtraFairnessTitle'), desc: t('homeExtraFairnessDesc'), icon: '◎' },
    { title: t('homeExtraSpectatorTitle'), desc: t('homeExtraSpectatorDesc'), icon: '⬒' },
    { title: t('homeExtraTeamOpsTitle'), desc: t('homeExtraTeamOpsDesc'), icon: '◫' }
  ];

  if (showInitialSkeleton) {
    return (
      <div className="home-page home-skeleton-page" aria-busy="true" aria-live="polite">
        <section className="home-hero">
          <div className="home-hero-inner">
            <div className="skeleton-line home-skeleton-title" />
            <div className="skeleton-line home-skeleton-intro" />
            <div className="skeleton-line home-skeleton-intro short" />
            <div className="home-skeleton-actions">
              <div className="skeleton-pill" />
              <div className="skeleton-pill" />
            </div>
          </div>
        </section>
        <Container className="home-content">
          <Row className="home-cards-grid mt-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Col key={`skeleton-top-${index}`} md={4}>
                <Card className="h-100 soft-card home-info-card">
                  <Card.Body>
                    <div className="skeleton-circle" />
                    <div className="skeleton-line medium" />
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </div>
    );
  }

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-inner">
          <h1 className="display-4 fw-bold mb-4 home-hero-title">
            {t('homeWelcome')} <span className="text-primary">HIU Selection</span>
          </h1>
          <p className="lead text-secondary mb-4 home-hero-intro">{t('homeIntro')}</p>
          {!user ? (
            <div className="d-flex gap-3 justify-content-center flex-wrap">
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
        </div>
      </section>

      <Container className="home-content">
        <Row className="home-cards-grid mt-2">
          {topCards.map((card, index) => (
            <Col key={card.title} md={4} className="home-reveal" style={{ '--reveal-delay': `${index * 70}ms` } as CSSProperties}>
              <Card className="h-100 soft-card home-info-card">
                <Card.Body>
                  <div className={`home-card-icon ${card.color}`}>{card.icon}</div>
                  <Card.Title className={card.color}>{card.title}</Card.Title>
                  <Card.Text className="text-secondary">{card.desc}</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        <Row className="mt-5 home-reveal" style={{ '--reveal-delay': '0ms' } as CSSProperties}>
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

        <Row className="mt-5 mb-2">
          <Col>
            <h4 className="section-title mb-3">{t('homeDetailsTitle')}</h4>
          </Col>
        </Row>

        <Row className="home-cards-grid">
          {detailCards.map((card, index) => (
            <Col key={card.title} md={6} lg={4} className="home-reveal" style={{ '--reveal-delay': `${(index % 3) * 80}ms` } as CSSProperties}>
              <Card className="h-100 soft-card home-info-card">
                <Card.Body>
                  <div className={`home-card-icon ${card.color}`}>{card.icon}</div>
                  <Card.Title className={card.color}>{card.title}</Card.Title>
                  <Card.Text className="text-secondary">{card.desc}</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        <Row className="mt-5 mb-2">
          <Col>
            <h4 className="section-title mb-3">{t('homeExtraTitle')}</h4>
          </Col>
        </Row>

        <Row className="home-cards-grid">
          {extraCards.map((card, index) => (
            <Col key={card.title} md={4} className="home-reveal" style={{ '--reveal-delay': `${index * 70}ms` } as CSSProperties}>
              <Card className="h-100 soft-card home-info-card">
                <Card.Body>
                  <div className="home-card-icon text-primary">{card.icon}</div>
                  <Card.Title className="text-primary">{card.title}</Card.Title>
                  <Card.Text className="text-secondary">{card.desc}</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        <footer className="home-footer home-reveal" style={{ '--reveal-delay': '120ms' } as CSSProperties}>
          <Row className="align-items-center g-3">
            <Col md={6}>
              <h6 className="mb-2 section-title">{t('homeFooterFollow')}</h6>
              <a
                href="https://web.facebook.com/profile.php?id=61554549129613"
                className="home-footer-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('homeFooterFacebook')}
              </a>
            </Col>
            <Col md={6} className="text-md-end text-secondary">
              {t('homeFooterCopyright')}
            </Col>
          </Row>
        </footer>
      </Container>
    </div>
  );
}

export default HomePage;
