import React from 'react';
import { ListGroup, Badge } from 'react-bootstrap';

function LiveFeed({ activity }) {
  if (activity.length === 0) {
    return <p className="text-secondary text-center">No activity yet</p>;
  }

  return (
    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
      <ListGroup variant="flush">
        {activity.map((item, index) => (
          <ListGroup.Item key={index} className="bg-transparent border-bottom border-secondary">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <strong>{item.team_name || item.teamName}</strong>
                <span className="text-secondary"> solved </span>
                <strong className="text-primary">{item.challenge_title || item.challengeTitle}</strong>
              </div>
              <Badge bg="success">+{item.points} pts</Badge>
            </div>
            <small className="text-secondary">
              {new Date(item.submitted_at || item.timestamp).toLocaleTimeString()}
            </small>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </div>
  );
}

export default LiveFeed;
