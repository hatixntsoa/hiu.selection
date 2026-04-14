import { Card } from 'react-bootstrap';
import { ScoreboardTeam } from '../../types';
import { usePreferences } from '../../context/PreferencesContext';

function LiveScoreboard({ teams }: { teams: ScoreboardTeam[] }): JSX.Element {
  const { t } = usePreferences();
  const sorted = [...teams].sort((a, b) => a.rank - b.rank);
  const first = sorted.find((team) => team.rank === 1);
  const second = sorted.find((team) => team.rank === 2);
  const third = sorted.find((team) => team.rank === 3);
  const others = sorted.filter((team) => team.rank > 3);

  if (sorted.length === 0) {
    return <p className="text-secondary text-center mb-0">{t('adminLiveNoTeams')}</p>;
  }

  return (
    <div className="admin-live-scoreboard">
      <div className="podium-grid">
        <div className="podium-slot">
          {second ? (
            <div className="podium-card podium-second">
              <div className="podium-rank">2</div>
              <div className="podium-team-name">{second.name}</div>
              <div className="podium-points">{second.score} pts</div>
            </div>
          ) : (
            <div className="podium-card podium-empty" />
          )}
        </div>
        <div className="podium-slot">
          {first ? (
            <div className="podium-card podium-first">
              <div className="podium-rank">1</div>
              <div className="podium-team-name">{first.name}</div>
              <div className="podium-points">{first.score} pts</div>
            </div>
          ) : (
            <div className="podium-card podium-empty" />
          )}
        </div>
        <div className="podium-slot">
          {third ? (
            <div className="podium-card podium-third">
              <div className="podium-rank">3</div>
              <div className="podium-team-name">{third.name}</div>
              <div className="podium-points">{third.score} pts</div>
            </div>
          ) : (
            <div className="podium-card podium-empty" />
          )}
        </div>
      </div>

      {others.length > 0 && (
        <Card className="soft-card mt-4">
          <Card.Body className="py-2">
            {others.map((team) => (
              <div key={team.id} className="live-score-row">
                <div className="live-score-rank">#{team.rank}</div>
                <div className="live-score-name">{team.name}</div>
                <div className="live-score-points">{team.score} pts</div>
              </div>
            ))}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

export default LiveScoreboard;
