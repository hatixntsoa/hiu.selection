import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row, Tab, Tabs } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';

type FormData = {
  name: string;
  password: string;
};

function LoginPage(): JSX.Element {
  const { login, register, user } = useAuth();
  const { t, localizeApiMessage } = usePreferences();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = useMemo(() => (searchParams.get('tab') === 'register' ? 'register' : 'login'), [searchParams]);

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (user) {
    navigate('/dashboard');
  }

  const handleLogin = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.name, formData.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(localizeApiMessage(err.response?.data?.error || t('authErrorLoginFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(formData.name, formData.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(localizeApiMessage(err.response?.data?.error || t('authErrorRegistrationFailed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Row className="justify-content-center">
        <Col md={6} lg={5}>
            <Card className="soft-card">
            <Card.Body>
              <h3 className="text-center mb-4 section-title">{t('loginTitle')}</h3>

              <Tabs
                activeKey={activeTab}
                onSelect={(k) => {
                  const nextTab = k === 'register' ? 'register' : 'login';
                  setActiveTab(nextTab);
                  setSearchParams({ tab: nextTab });
                  setError('');
                }}
                className="mb-4"
                justify
              >
                <Tab eventKey="login" title={t('loginTab')}>
                  <Form onSubmit={handleLogin}>
                    <Form.Group className="mb-3">
                      <Form.Label>{t('registerTeamName')}</Form.Label>
                      <Form.Control
                        type="text"
                        name="name"
                        placeholder={t('registerTeamPlaceholder')}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>{t('loginPassword')}</Form.Label>
                      <Form.Control
                        type="password"
                        name="password"
                        placeholder={t('loginPasswordPlaceholder')}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                    </Form.Group>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                      {loading ? t('loginButtonLoading') : t('loginButton')}
                    </Button>
                  </Form>
                </Tab>
                <Tab eventKey="register" title={t('registerTab')}>
                  <Form onSubmit={handleRegister}>
                    <Form.Group className="mb-3">
                      <Form.Label>{t('registerTeamName')}</Form.Label>
                      <Form.Control
                        type="text"
                        name="name"
                        placeholder={t('registerTeamPlaceholder')}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>{t('loginPassword')}</Form.Label>
                      <Form.Control
                        type="password"
                        name="password"
                        placeholder={t('registerPasswordPlaceholder')}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </Form.Group>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Button variant="success" type="submit" className="w-100" disabled={loading}>
                      {loading ? t('registerButtonLoading') : t('registerButton')}
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
