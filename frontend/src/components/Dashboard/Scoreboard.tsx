import { Badge, Table } from 'react-bootstrap';
import { ScoreboardTeam } from '../../types';
import { usePreferences } from '../../context/PreferencesContext';

function Scoreboard({
  scoreboard,
  currentUserId
}: {
  scoreboard: ScoreboardTeam[];
  currentUserId?: number;
}): JSX.Element {
  const { t } = usePreferences();

  if (scoreboard.length === 0) {
    return <p className="text-secondary text-center mb-0">{t('scoreboardNoTeams')}</p>;
  }

  return (
    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
      <Table striped bordered hover responsive className="warm-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('scoreboardTeam')}</th>
            <th className="text-end">{t('scoreboardPoints')}</th>
          </tr>
        </thead>
        <tbody>
          {scoreboard.map((team) => (
            <tr key={team.id} className={team.id === currentUserId ? 'table-active' : ''}>
              <td>
                {team.rank === 1 && '🥇'}
                {team.rank === 2 && '🥈'}
                {team.rank === 3 && '🥉'}
                {team.rank !== null && team.rank > 3 && team.rank}
              </td>
              <td>
                {team.name}
                {team.id === currentUserId && (
                  <Badge bg="primary" className="ms-2">
                    {t('scoreboardYou')}
                  </Badge>
                )}
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
