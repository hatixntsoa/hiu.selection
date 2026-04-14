import { useEffect, useMemo, useState } from 'react';
import { Card, Container } from 'react-bootstrap';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { ScoreboardTeam } from '../types';
import { usePreferences } from '../context/PreferencesContext';

function CtfEndedPage(): JSX.Element {
  const { user } = useAuth();
  const { t } = usePreferences();
  const [scoreboard, setScoreboard] = useState<ScoreboardTeam[]>([]);

  useEffect(() => {
    const loadScoreboard = (): void => {
      api
        .get('/scoreboard')
        .then((response) => setScoreboard(response.data.scoreboard as ScoreboardTeam[]))
        .catch(() => undefined);
    };

    loadScoreboard();
    const socket = connectSocket();
    socket.on('scoreboard_update', loadScoreboard);
    return () => {
      socket.off('scoreboard_update', loadScoreboard);
    };
  }, []);

  const rank = useMemo(() => {
    if (!user) {
      return '-';
    }
    const team = scoreboard.find((item) => item.id === user.id);
    return team?.rank ? `#${team.rank}` : '-';
  }, [scoreboard, user]);

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '75vh' }}>
      <Card className="soft-card text-center px-4 py-5 w-100" style={{ maxWidth: 720 }}>
        <h1 className="display-3 fw-bold mb-3 section-title">{t('ctfEndedTitle')}</h1>
        <p className="text-secondary mb-4">{t('ctfEndedSubtitle')}</p>
        <h2 className="mb-3">{user?.name || '-'}</h2>
        <p className="mb-2 fs-4">
          <strong>{t('ctfEndedRank')}:</strong> {rank}
        </p>
        <p className="mb-0 fs-4">
          <strong>{t('ctfEndedPoints')}:</strong> {user?.score || 0}
        </p>
      </Card>
    </Container>
  );
}

export default CtfEndedPage;
