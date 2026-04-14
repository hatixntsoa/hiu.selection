import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Tabs, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate('/dashboard');
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(formData.name, formData.email, formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Row className="justify-content-center">
        <Col md={6} lg={5}>
          <Card>
            <Card.Body>
              <h3 className="text-center mb-4">Team Authentication</h3>
              
              <Tabs
                activeKey={activeTab}
                onSelect={(k) => {
                  setActiveTab(k);
                  setError('');
                }}
                className="mb-4"
                justify
              >
                <Tab eventKey="login" title="Login">
                  <Form onSubmit={handleLogin}>
                    <Form.Group className="mb-3">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        placeholder="team@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Password</Form.Label>
                      <Form.Control
                        type="password"
                        name="password"
                        placeholder="Password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                      {loading ? 'Logging in...' : 'Login'}
                    </Button>
                  </Form>
                </Tab>
                <Tab eventKey="register" title="Register">
                  <Form onSubmit={handleRegister}>
                    <Form.Group className="mb-3">
                      <Form.Label>Team Name</Form.Label>
                      <Form.Control
                        type="text"
                        name="name"
                        placeholder="Team Awesome"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        placeholder="team@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Password</Form.Label>
                      <Form.Control
                        type="password"
                        name="password"
                        placeholder="Min 6 characters"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        minLength={6}
                      />
                    </Form.Group>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Button variant="success" type="submit" className="w-100" disabled={loading}>
                      {loading ? 'Registering...' : 'Register'}
                    </Button>
                  </Form>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default LoginPage;
