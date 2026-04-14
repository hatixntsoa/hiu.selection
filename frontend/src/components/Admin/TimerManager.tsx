import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Row, Col } from 'react-bootstrap';
import api from '../../services/api';
import { CtfTimerState } from '../../types';
import { usePreferences } from '../../context/PreferencesContext';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((value) => String(value).padStart(2, '0')).join(':');
}

function TimerManager({
  timer,
  onTimerChange
}: {
  timer: CtfTimerState | null;
  onTimerChange: (next: CtfTimerState) => void;
}): JSX.Element {
  const { t, localizeApiMessage } = usePreferences();
  const [durationMinutes, setDurationMinutes] = useState('120');
  const [addMinutes, setAddMinutes] = useState('15');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (timer?.durationSeconds) {
      setDurationMinutes(String(Math.max(1, Math.floor(timer.durationSeconds / 60))));
    }
  }, [timer?.durationSeconds]);

  const timerLabel = useMemo(() => {
    if (!timer) {
      return t('timerNotStarted');
    }
    if (timer.isInfinite) {
      return t('timerInfinite');
    }
    if (!timer.canSubmit) {
      return t('timerFinished');
    }
    if (typeof timer.timeLeftSeconds === 'number') {
      return formatTime(timer.timeLeftSeconds);
    }
    return t('timerNotStarted');
  }, [timer, t]);

  const statusVariant = timer?.isInfinite ? 'warning' : timer?.canSubmit ? 'success' : 'danger';
  const statusText = timer?.isInfinite
    ? t('timerInfinite')
    : timer?.canSubmit
      ? t('adminTimerStatusRunning')
      : t('adminTimerStatusExpired');

  const safeDurationMinutes = (): number => {
    const parsed = Number(durationMinutes);
    if (!Number.isFinite(parsed)) {
      return 120;
    }
    return Math.max(1, Math.floor(parsed));
  };

  const safeAddMinutes = (): number => {
    const parsed = Number(addMinutes);
    if (!Number.isFinite(parsed)) {
      return 1;
    }
    return Math.max(1, Math.floor(parsed));
  };

  const runAction = async (action: () => Promise<CtfTimerState>): Promise<void> => {
    setError('');
    setSuccess('');
    try {
      const nextTimer = await action();
      onTimerChange(nextTimer);
      setSuccess(t('adminTimerUpdated'));
    } catch (err: any) {
      setError(localizeApiMessage(err.response?.data?.error || t('apiDatabaseError')));
    }
  };

  const handleSaveDuration = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    await runAction(async () => {
      const response = await api.put('/scoreboard/timer', { durationSeconds: safeDurationMinutes() * 60 });
      return response.data.timer as CtfTimerState;
    });
  };

  const handleRestart = async (): Promise<void> => {
    await runAction(async () => {
      const response = await api.post('/scoreboard/timer/restart', { durationSeconds: safeDurationMinutes() * 60 });
      return response.data.timer as CtfTimerState;
    });
  };

  const handleAddTime = async (): Promise<void> => {
    await runAction(async () => {
      const response = await api.post('/scoreboard/timer/add-time', { seconds: safeAddMinutes() * 60 });
      return response.data.timer as CtfTimerState;
    });
  };

  const handleInfinite = async (): Promise<void> => {
    await runAction(async () => {
      const response = await api.post('/scoreboard/timer/infinite');
      return response.data.timer as CtfTimerState;
    });
  };

  return (
    <Card className="soft-card">
      <Card.Header>
        <h4 className="mb-1 section-title">{t('adminTimerTitle')}</h4>
        <p className="mb-0 text-secondary">{t('adminTimerSubtitle')}</p>
      </Card.Header>
      <Card.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <div className="text-secondary">{t('adminTimerCurrent')}</div>
            <div className="timer-value-display">{timerLabel}</div>
          </div>
          <Badge bg={statusVariant}>{statusText}</Badge>
        </div>

        <Form onSubmit={handleSaveDuration}>
          <Row className="g-3 align-items-end">
            <Col md={4}>
              <Form.Label>{t('adminTimerDuration')}</Form.Label>
              <Form.Control
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </Col>
            <Col md="auto">
              <Button type="submit" variant="primary">
                {t('adminTimerSaveDuration')}
              </Button>
            </Col>
            <Col md="auto">
              <Button type="button" variant="warning" onClick={handleRestart}>
                {t('adminTimerRestart')}
              </Button>
            </Col>
          </Row>
        </Form>

        <hr />

        <Row className="g-3 align-items-end">
          <Col md={4}>
            <Form.Label>{t('adminTimerAdd')}</Form.Label>
            <Form.Control type="number" min={1} value={addMinutes} onChange={(e) => setAddMinutes(e.target.value)} />
          </Col>
          <Col md="auto">
            <Button type="button" variant="success" onClick={handleAddTime}>
              {t('adminTimerAddButton')}
            </Button>
          </Col>
          <Col md="auto">
            <Button type="button" variant="outline-secondary" onClick={handleInfinite}>
              {t('adminTimerInfinite')}
            </Button>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}

export default TimerManager;
