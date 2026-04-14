import { Badge, Button, Card, Col, Row } from 'react-bootstrap';
import { Challenge } from '../../types';
import { usePreferences } from '../../context/PreferencesContext';

function ChallengeList({
  challenges,
  solvedChallenges,
  onOpenChallenge,
  activeChallengeId,
  disabled = false
}: {
  challenges: Challenge[];
  solvedChallenges: Set<number>;
  onOpenChallenge: (challenge: Challenge) => void;
  activeChallengeId: number | null;
  disabled?: boolean;
}): JSX.Element {
  const { t } = usePreferences();

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      Web: 'primary',
      Crypto: 'warning',
      Reverse: 'danger',
      Misc: 'info',
      SQL: 'success',
      Forensics: 'secondary'
    };
    return colors[category] || 'secondary';
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      Web: t('categoryWeb'),
      Crypto: t('categoryCrypto'),
      Reverse: t('categoryReverse'),
      Misc: t('categoryMisc'),
      SQL: t('categorySQL'),
      Forensics: t('categoryForensics')
    };
    return labels[category] || category;
  };

  if (challenges.length === 0) {
    return <p className="text-secondary text-center mb-0">{t('challengesNone')}</p>;
  }

  return (
    <Row className="g-3">
      {challenges.map((challenge) => {
        const isSolved = solvedChallenges.has(challenge.id);
        const isSelected = activeChallengeId === challenge.id;

        return (
          <Col key={challenge.id} sm={6} lg={4}>
            <Card
              className={`h-100 soft-card ${isSolved ? 'border-success' : ''} ${isSelected ? 'border-primary' : ''}`}
              style={{ cursor: disabled ? 'not-allowed' : 'pointer', borderWidth: '2px', opacity: disabled ? 0.65 : 1 }}
              onClick={() => {
                if (!disabled) {
                  onOpenChallenge(challenge);
                }
              }}
            >
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <Badge bg={getCategoryColor(challenge.category)}>{getCategoryLabel(challenge.category)}</Badge>
                  {isSolved && <Badge bg="success">✓ {t('challengesSolved')}</Badge>}
                </div>
                {challenge.challenge_code && (
                  <div className="text-secondary small mb-1">
                    <code>{challenge.challenge_code}</code>
                  </div>
                )}
                <Card.Title className="h5">{challenge.title}</Card.Title>
                <Card.Text className="text-secondary small">{challenge.description}</Card.Text>
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <span className="text-primary fw-bold">{challenge.points} pts</span>
                  <Button variant={isSelected ? 'primary' : 'outline-primary'} size="sm" disabled={disabled}>
                    {t('challengesOpen')}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}

export default ChallengeList;
