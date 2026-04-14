import { Badge, Button, Card, Col, Row } from 'react-bootstrap';
import { Challenge } from '../../types';

function ChallengeList({
  challenges,
  solvedChallenges,
  onSelectChallenge,
  selectedChallenge
}: {
  challenges: Challenge[];
  solvedChallenges: Set<number>;
  onSelectChallenge: (id: number) => void;
  selectedChallenge: number | null;
}): JSX.Element {
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

  if (challenges.length === 0) {
    return <p className="text-secondary text-center mb-0">No challenges available</p>;
  }

  return (
    <Row className="g-3">
      {challenges.map((challenge) => {
        const isSolved = solvedChallenges.has(challenge.id);
        const isSelected = selectedChallenge === challenge.id;

        return (
          <Col key={challenge.id} sm={6} lg={4}>
            <Card
              className={`h-100 soft-card ${isSolved ? 'border-success' : ''} ${isSelected ? 'border-primary' : ''}`}
              style={{ cursor: 'pointer', borderWidth: '2px' }}
              onClick={() => onSelectChallenge(challenge.id)}
            >
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <Badge bg={getCategoryColor(challenge.category)}>{challenge.category}</Badge>
                  {isSolved && <Badge bg="success">✓ Solved</Badge>}
                </div>
                <Card.Title className="h5">{challenge.title}</Card.Title>
                <Card.Text className="text-secondary small">{challenge.description}</Card.Text>
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <span className="text-primary fw-bold">{challenge.points} pts</span>
                  <Button variant={isSelected ? 'primary' : 'outline-primary'} size="sm" disabled={isSolved}>
                    {isSelected ? 'Selected' : isSolved ? 'Solved' : 'Select'}
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
