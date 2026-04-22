import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from 'react-bootstrap';
import { ScoreboardTeam } from '../../types';
import { usePreferences } from '../../context/PreferencesContext';

function LiveScoreboard({ teams, fullscreen = false }: { teams: ScoreboardTeam[]; fullscreen?: boolean }): JSX.Element {
  const { t } = usePreferences();
  const scoreboardRef = useRef<HTMLDivElement | null>(null);
  const podiumRef = useRef<HTMLDivElement | null>(null);
  const previousScoresRef = useRef<Map<number, number>>(new Map());
  const pulseTimeoutsRef = useRef<Map<number, number>>(new Map());
  const rankedTeams = [...teams].filter((team) => team.rank !== null).sort((a, b) => Number(a.rank) - Number(b.rank));
  const unrankedTeams = [...teams].filter((team) => team.rank === null);
  const first = rankedTeams.find((team) => team.rank === 1);
  const second = rankedTeams.find((team) => team.rank === 2);
  const third = rankedTeams.find((team) => team.rank === 3);
  const others = [...rankedTeams.filter((team) => Number(team.rank) > 3), ...unrankedTeams];
  const [rowsPerColumn, setRowsPerColumn] = useState(8);
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
    teams.forEach((team) => {
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
  }, [teams]);

  useEffect(() => {
    if (!fullscreen) {
      setRowsPerColumn(Math.max(others.length, 1));
      return;
    }

    const recalcRowsPerColumn = (): void => {
      const boardHeight = scoreboardRef.current?.clientHeight ?? 0;
      const podiumHeight = podiumRef.current?.clientHeight ?? 0;
      const availableHeight = Math.max(0, boardHeight - podiumHeight - 26);
      const estimatedRowHeight = 58;
      const computedRows = Math.max(1, Math.min(4, Math.floor(availableHeight / estimatedRowHeight)));
      setRowsPerColumn(computedRows);
    };

    recalcRowsPerColumn();
    window.addEventListener('resize', recalcRowsPerColumn);
    return () => window.removeEventListener('resize', recalcRowsPerColumn);
  }, [fullscreen, others.length]);

  const otherColumns = useMemo(() => {
    const columns: ScoreboardTeam[][] = [];
    const chunkSize = Math.max(1, rowsPerColumn);
    for (let index = 0; index < others.length; index += chunkSize) {
      columns.push(others.slice(index, index + chunkSize));
    }
    return columns;
  }, [others, rowsPerColumn]);

  if (teams.length === 0) {
    return <p className="text-secondary text-center mb-0">{t('adminLiveNoTeams')}</p>;
  }

  return (
    <div className="admin-live-scoreboard" ref={scoreboardRef}>
      <div className="podium-grid" ref={podiumRef}>
        <div className="podium-slot">
          {second ? (
            <div className={`podium-card podium-second${pulsingTeamIds.has(second.id) ? ' score-pulse-row' : ''}`}>
              <div className={`podium-rank${pulsingTeamIds.has(second.id) ? ' score-pulse-peg' : ''}`}>🥈</div>
              <div className="podium-team-name">{second.name}</div>
              <div className="podium-points">{second.score} pts</div>
            </div>
          ) : (
            <div className="podium-card podium-empty" />
          )}
        </div>
        <div className="podium-slot">
          {first ? (
            <div className={`podium-card podium-first${pulsingTeamIds.has(first.id) ? ' score-pulse-row' : ''}`}>
              <div className={`podium-rank${pulsingTeamIds.has(first.id) ? ' score-pulse-peg' : ''}`}>🥇</div>
              <div className="podium-team-name">{first.name}</div>
              <div className="podium-points">{first.score} pts</div>
            </div>
          ) : (
            <div className="podium-card podium-empty" />
          )}
        </div>
        <div className="podium-slot">
          {third ? (
            <div className={`podium-card podium-third${pulsingTeamIds.has(third.id) ? ' score-pulse-row' : ''}`}>
              <div className={`podium-rank${pulsingTeamIds.has(third.id) ? ' score-pulse-peg' : ''}`}>🥉</div>
              <div className="podium-team-name">{third.name}</div>
              <div className="podium-points">{third.score} pts</div>
            </div>
          ) : (
            <div className="podium-card podium-empty" />
          )}
        </div>
      </div>

      {others.length > 0 && (
        <div
          className={`live-score-columns ${fullscreen ? 'mt-3' : 'mt-4'}`}
          style={fullscreen ? { gridTemplateColumns: `repeat(${otherColumns.length}, minmax(0, 1fr))` } : undefined}
        >
          {otherColumns.map((column, columnIndex) => (
            <Card key={columnIndex} className="soft-card live-score-column-card">
              <Card.Body className="py-2">
                {column.map((team) => (
                  <div key={team.id} className={`live-score-row${pulsingTeamIds.has(team.id) ? ' score-pulse-row' : ''}`}>
                    <div className={`live-score-rank${pulsingTeamIds.has(team.id) ? ' score-pulse-peg' : ''}`}>
                      {team.rank ? `#${team.rank}` : ''}
                    </div>
                    <div className="live-score-name">{team.name}</div>
                    <div className="live-score-points">{team.score} pts</div>
                  </div>
                ))}
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default LiveScoreboard;
