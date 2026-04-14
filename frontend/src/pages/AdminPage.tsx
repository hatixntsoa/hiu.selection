import { useEffect, useState } from 'react';
import { Card, Col, Container, Row, Tab, Table, Tabs } from 'react-bootstrap';
import api from '../services/api';
import ChallengeManager from '../components/Admin/ChallengeManager';
import { ScoreboardTeam } from '../types';

function AdminPage(): JSX.Element {
  const [teams, setTeams] = useState<ScoreboardTeam[]>([]);

  const fetchData = async (): Promise<void> => {
    try {
      const [scoreboardRes] = await Promise.all([api.get('/scoreboard'), api.get('/challenges?includeFlag=true')]);
      setTeams(scoreboardRes.data.scoreboard as ScoreboardTeam[]);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h2 className="section-title">Admin Panel</h2>
          <p className="text-secondary">Manage challenges and monitor CTF progress.</p>
        </Col>
      </Row>

      <Tabs defaultActiveKey="challenges" className="mb-4">
        <Tab eventKey="challenges" title="Challenges">
          <Card className="mt-3 soft-card">
            <Card.Body>
              <ChallengeManager onChallengeChange={fetchData} />
            </Card.Body>
          </Card>
        </Tab>
        <Tab eventKey="teams" title="Teams">
          <Card className="mt-3 soft-card">
            <Card.Header>
              <h5 className="mb-0 section-title">Registered Teams</h5>
            </Card.Header>
            <Card.Body>
              <Table striped bordered hover responsive className="warm-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team Name</th>
                    <th>Score</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team, index) => (
                    <tr key={team.id}>
                      <td>#{index + 1}</td>
                      <td>{team.name}</td>
                      <td>
                        <strong>{team.score}</strong>
                      </td>
                      <td>{team.created_at ? new Date(team.created_at).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </Container>
  );
}

export default AdminPage;
