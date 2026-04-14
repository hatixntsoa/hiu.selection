import { Badge, ListGroup } from 'react-bootstrap';
import { ActivityItem } from '../../types';
import { usePreferences } from '../../context/PreferencesContext';

function LiveFeed({ activity }: { activity: ActivityItem[] }): JSX.Element {
  const { t, language } = usePreferences();

  if (activity.length === 0) {
    return <p className="text-secondary text-center mb-0">{t('liveFeedNoActivity')}</p>;
  }

  return (
    <div className="hide-scrollbar" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <ListGroup variant="flush">
          {activity.map((item, index) => (
            <ListGroup.Item key={index} className="bg-transparent activity-item">
              <div className="d-flex justify-content-between align-items-start">
              <div>
                <strong>{item.team_name || item.teamName}</strong>
                <span className="text-secondary">{t('liveFeedSolved')}</span>
                <strong className="text-primary">{item.challenge_title || item.challengeTitle}</strong>
              </div>
              <Badge bg="success">+{item.points} pts</Badge>
            </div>
            <small className="text-secondary">
              {new Date(item.submitted_at || item.timestamp || Date.now()).toLocaleTimeString(
                language === 'fr' ? 'fr-FR' : 'en-US'
              )}
            </small>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </div>
  );
}

export default LiveFeed;
