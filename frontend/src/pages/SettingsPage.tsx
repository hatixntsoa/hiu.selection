import { Alert, Card, Col, Container, Form, Row } from 'react-bootstrap';
import { usePreferences } from '../context/PreferencesContext';

function SettingsPage(): JSX.Element {
  const { themeMode, setThemeMode, language, setLanguage, t } = usePreferences();

  return (
    <Container>
      <Row className="justify-content-center">
        <Col lg={8}>
          <Card className="soft-card">
            <Card.Body>
              <h2 className="section-title mb-2">{t('settingsTitle')}</h2>
              <p className="text-secondary mb-4">{t('settingsSubtitle')}</p>

              <Form.Group className="mb-4">
                <Form.Label className="fw-semibold">{t('settingsThemeTitle')}</Form.Label>
                <Form.Select
                  value={themeMode}
                  onChange={(e) => setThemeMode(e.target.value as 'system' | 'light' | 'dark')}
                >
                  <option value="system">{t('settingsThemeSystem')}</option>
                  <option value="light">{t('settingsThemeLight')}</option>
                  <option value="dark">{t('settingsThemeDark')}</option>
                </Form.Select>
                <Form.Text className="text-secondary">{t('settingsThemeHelp')}</Form.Text>
              </Form.Group>

              <Form.Group>
                <Form.Label className="fw-semibold">{t('settingsLanguageTitle')}</Form.Label>
                <Form.Select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'fr')}
                >
                  <option value="en">{t('settingsLanguageEnglish')}</option>
                  <option value="fr">{t('settingsLanguageFrench')}</option>
                </Form.Select>
              </Form.Group>

              <Alert variant="success" className="mt-4 mb-0">
                {t('settingsApplied')}
              </Alert>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default SettingsPage;
