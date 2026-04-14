import React from 'react';
import { Table, Badge } from 'react-bootstrap';

function Scoreboard({ scoreboard, currentUserId }) {
  if (scoreboard.length === 0) {
    return <p className="text-secondary text-center">No teams yet</p>;
  }

  return (
    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
      <Table striped bordered hover responsive size="sm">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th className="text-end">Points</th>
          </tr>
        </thead>
        <tbody>
          {scoreboard.map((team) => (
            <tr
              key={team.id}
              className={team.id === currentUserId ? 'table-active' : ''}
            >
              <td>
                {team.rank === 1 && '🥇'}
                {team.rank === 2 && '🥈'}
                {team.rank === 3 && '🥉'}
                {team.rank > 3 && team.rank}
              </td>
              <td>
                {team.name}
                {team.id === currentUserId && <Badge bg="primary" className="ms-2">You</Badge>}
              </td>
              <td className="text-end">
                <strong>{team.score}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default Scoreboard;
