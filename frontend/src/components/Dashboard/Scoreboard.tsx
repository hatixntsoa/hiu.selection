import { useEffect, useRef, useState } from 'react';
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
  const previousScoresRef = useRef<Map<number, number>>(new Map());
  const pulseTimeoutsRef = useRef<Map<number, number>>(new Map());
  const [pulsingTeamIds, setPulsingTeamIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      pulseTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      pulseTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const nextScores = new Map<number, number>();
    const increasedTeamIds: number[] = [];
    scoreboard.forEach((team) => {
      nextScores.set(team.id, team.score);
      const previousScore = previousScoresRef.current.get(team.id);
      if (typeof previousScore === 'number' && team.score > previousScore) {
        increasedTeamIds.push(team.id);
      }
    });
    previousScoresRef.current = nextScores;

    if (increasedTeamIds.length === 0) {
      return;
    }

    increasedTeamIds.forEach((teamId) => {
      const existingTimeout = pulseTimeoutsRef.current.get(teamId);
      if (typeof existingTimeout === 'number') {
        window.clearTimeout(existingTimeout);
      }

      setPulsingTeamIds((previous) => {
        const next = new Set(previous);
        next.add(teamId);
        return next;
      });

      const timeout = window.setTimeout(() => {
        setPulsingTeamIds((previous) => {
          const next = new Set(previous);
          next.delete(teamId);
          return next;
        });
        pulseTimeoutsRef.current.delete(teamId);
      }, 1500);
      pulseTimeoutsRef.current.set(teamId, timeout);
    });
  }, [scoreboard]);

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
          {scoreboard.map((team) => {
            const isPulsing = pulsingTeamIds.has(team.id);
            return (
              <tr key={team.id} className={team.id === currentUserId ? 'table-active' : ''}>
                <td>
                  <span className={`rank-peg${isPulsing ? ' score-pulse-peg' : ''}`}>
                    {team.rank === 1 && '🥇'}
                    {team.rank === 2 && '🥈'}
                    {team.rank === 3 && '🥉'}
                    {team.rank !== null && team.rank > 3 && team.rank}
                  </span>
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
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

export default Scoreboard;
