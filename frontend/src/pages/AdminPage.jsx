import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Modal, Form, Alert, Tabs, Tab } from 'react-bootstrap';
import api from '../services/api';
import ChallengeManager from '../components/Admin/ChallengeManager';

function AdminPage() {
  const [teams, setTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [scoreboardRes, challengesRes] = await Promise.all([
        api.get('/scoreboard'),
        api.get('/challenges?includeFlag=true')
      ]);
      setTeams(scoreboardRes.data.scoreboard);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h2>Admin Panel</h2>
          <p className="text-secondary">Manage challenges and monitor CTF progress</p>
        </Col>
      </Row>

      <Tabs defaultActiveKey="challenges" className="mb-4">
        <Tab eventKey="challenges" title="🚩 Challenges">
          <Card className="mt-3">
            <Card.Body>
              <ChallengeManager onChallengeChange={fetchData} />
            </Card.Body>
          </Card>
        </Tab>
        <Tab eventKey="teams" title="👥 Teams">
          <Card className="mt-3">
            <Card.Header>
              <h5 className="mb-0">Registered Teams</h5>
            </Card.Header>
            <Card.Body>
              <Table striped bordered hover responsive>
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
                      <td><strong>{team.score}</strong></td>
                      <td>{new Date(team.created_at).toLocaleDateString()}</td>
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
