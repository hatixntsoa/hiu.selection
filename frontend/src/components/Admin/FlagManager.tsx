import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Modal, Table } from 'react-bootstrap';
import api from '../../services/api';
import { Challenge, Difficulty } from '../../types';
import { usePreferences } from '../../context/PreferencesContext';

type FlagForm = {
  title: string;
  description: string;
  flag: string;
  difficulty: Difficulty;
  first_blood_points: string;
  second_blood_points: string;
  default_points: string;
};

const DIFFICULTY_DEFAULT_POINTS: Record<Difficulty, { first: number; second: number; third: number }> = {
  easy: { first: 100, second: 75, third: 50 },
  medium: { first: 200, second: 150, third: 100 },
  hard: { first: 300, second: 225, third: 150 }
};

function normalizeDifficulty(value: unknown): Difficulty {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard') {
    return normalized;
  }
  return 'easy';
}

function difficultyLabelKey(difficulty: Difficulty): 'difficultyEasy' | 'difficultyMedium' | 'difficultyHard' {
  if (difficulty === 'medium') {
    return 'difficultyMedium';
  }
  if (difficulty === 'hard') {
    return 'difficultyHard';
  }
  return 'difficultyEasy';
}

function parseTxtFlags(content: string): string[] {
  return content
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function FlagManager({ onFlagChange }: { onFlagChange?: () => void }): JSX.Element {
  const { t, localizeApiMessage } = usePreferences();
  const [flags, setFlags] = useState<Challenge[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingFlag, setEditingFlag] = useState<Challenge | null>(null);
  const [deletingFlag, setDeletingFlag] = useState<Challenge | null>(null);
  const [formData, setFormData] = useState<FlagForm>({
    title: '',
    description: '',
    flag: '',
    difficulty: 'easy',
    first_blood_points: '100',
    second_blood_points: '75',
    default_points: '50'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const importHint = useMemo(
    () => t('adminFlagsImportHint'),
    [t]
  );

  useEffect(() => {
    void fetchFlags();
  }, []);

  const fetchFlags = async (): Promise<void> => {
    try {
      const response = await api.get('/challenges?includeFlag=true');
      setFlags(response.data.challenges as Challenge[]);
    } catch (err) {
      console.error('Error fetching flags:', err);
    }
  };

  const handleShowModal = (flagItem: Challenge | null = null): void => {
    if (flagItem) {
      setEditingFlag(flagItem);
      setFormData({
        title: flagItem.title || '',
        description: flagItem.description || '',
        flag: flagItem.flag || '',
        difficulty: normalizeDifficulty(flagItem.difficulty),
        first_blood_points: String(flagItem.first_blood_points || 100),
        second_blood_points: String(flagItem.second_blood_points || 75),
        default_points: String(flagItem.default_points || 50)
      });
    } else {
      setEditingFlag(null);
      setFormData({
        title: '',
        description: '',
        flag: '',
        difficulty: 'easy',
        first_blood_points: '100',
        second_blood_points: '75',
        default_points: '50'
      });
    }
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        flag: formData.flag.trim(),
        difficulty: formData.difficulty,
        first_blood_points: Number(formData.first_blood_points || 100),
        second_blood_points: Number(formData.second_blood_points || 75),
        default_points: Number(formData.default_points || 50)
      };
      if (editingFlag) {
        await api.put(`/challenges/${editingFlag.id}`, payload);
        setSuccess(t('adminFlagsUpdated'));
      } else {
        await api.post('/challenges', payload);
        setSuccess(t('adminFlagsCreated'));
      }
      setShowModal(false);
      await fetchFlags();
      onFlagChange?.();
    } catch (err: any) {
      setError(localizeApiMessage(err.response?.data?.error || t('adminFlagsSaveFailed')));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deletingFlag) {
      return;
    }
    try {
      await api.delete(`/challenges/${deletingFlag.id}`);
      setShowDeleteModal(false);
      setDeletingFlag(null);
      setSuccess(t('adminFlagsDeleted'));
      await fetchFlags();
      onFlagChange?.();
    } catch (err: any) {
      setError(localizeApiMessage(err.response?.data?.error || t('adminFlagsDeleteFailed')));
    }
  };

  const runImport = async (items: string[]): Promise<void> => {
    const uniqueFlags = Array.from(new Set(items.map((value) => value.trim()).filter((value) => value.length > 0)));
    if (uniqueFlags.length === 0) {
      setError(t('adminFlagsImportNoValid'));
      return;
    }
    setIsImporting(true);
    setError('');
    setSuccess('');
    try {
      const payload = { flags: uniqueFlags.map((value) => ({ flag: value })) };
      const response = await api.post('/challenges/import', payload);
      setSuccess(t('adminFlagsImported', { count: Number(response.data.count) || uniqueFlags.length }));
      setShowModal(false);
      await fetchFlags();
      onFlagChange?.();
    } catch (err: any) {
      setError(localizeApiMessage(err.response?.data?.error || t('adminFlagsImportFailed')));
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileList = async (fileList: FileList | null): Promise<void> => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const txtFiles = Array.from(fileList).filter((file) => file.name.toLowerCase().endsWith('.txt'));
    if (txtFiles.length === 0) {
      setError(t('adminFlagsImportTxtOnly'));
      return;
    }
    const allFlags: string[] = [];
    for (const file of txtFiles) {
      const content = await file.text();
      allFlags.push(...parseTxtFlags(content));
    }
    await runImport(allFlags);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    void handleFileList(e.dataTransfer.files);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
  };

  const handleInputImport = (e: ChangeEvent<HTMLInputElement>): void => {
    void handleFileList(e.target.files);
    e.target.value = '';
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0 section-title">{t('adminFlagsTitle')}</h5>
        <Button variant="primary" onClick={() => handleShowModal()}>
          {t('adminFlagsAdd')}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Table striped bordered hover responsive className="warm-table">
        <thead>
          <tr>
            <th>{t('managerTableId')}</th>
            <th>{t('managerFieldTitle')}</th>
            <th>{t('managerFieldDescription')}</th>
            <th>{t('managerTableFlag')}</th>
            <th>{t('managerTableDifficulty')}</th>
            <th>{t('managerTablePoints')}</th>
            <th>{t('managerTableActions')}</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((item) => (
            <tr key={item.id}>
              <td><code>{item.public_id || item.id}</code></td>
              <td>{item.title || '-'}</td>
              <td>{item.description || '-'}</td>
              <td><code>{item.flag}</code></td>
              <td>{t(difficultyLabelKey(normalizeDifficulty(item.difficulty)))}</td>
              <td>{`${item.first_blood_points || 100}|${item.second_blood_points || 75}|${item.default_points || 50}`}</td>
              <td>
                <Button variant="success" size="sm" className="me-2" onClick={() => handleShowModal(item)}>
                  {t('managerEdit')}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setDeletingFlag(item);
                    setShowDeleteModal(true);
                  }}
                >
                  {t('managerDelete')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editingFlag ? t('adminFlagsEdit') : t('adminFlagsAdd')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('managerFieldTitle')}</Form.Label>
              <Form.Control
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('managerFieldDescription')}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('managerFieldFlag')}</Form.Label>
              <Form.Control
                type="text"
                required
                value={formData.flag}
                onChange={(e) => setFormData((prev) => ({ ...prev, flag: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('managerTableDifficulty')}</Form.Label>
              <Form.Select
                value={formData.difficulty}
                onChange={(e) => {
                  const difficulty = normalizeDifficulty(e.target.value);
                  const defaults = DIFFICULTY_DEFAULT_POINTS[difficulty];
                  setFormData((prev) => ({
                    ...prev,
                    difficulty,
                    first_blood_points: String(defaults.first),
                    second_blood_points: String(defaults.second),
                    default_points: String(defaults.third)
                  }));
                }}
              >
                <option value="easy">{t('difficultyEasy')}</option>
                <option value="medium">{t('difficultyMedium')}</option>
                <option value="hard">{t('difficultyHard')}</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('adminFlagsFirstBlood')}</Form.Label>
              <Form.Control
                type="number"
                min="1"
                value={formData.first_blood_points}
                onChange={(e) => setFormData((prev) => ({ ...prev, first_blood_points: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('adminFlagsSecondBlood')}</Form.Label>
              <Form.Control
                type="number"
                min="1"
                value={formData.second_blood_points}
                onChange={(e) => setFormData((prev) => ({ ...prev, second_blood_points: e.target.value }))}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>{t('adminFlagsDefaultPoints')}</Form.Label>
              <Form.Control
                type="number"
                min="1"
                value={formData.default_points}
                onChange={(e) => setFormData((prev) => ({ ...prev, default_points: e.target.value }))}
              />
            </Form.Group>
            {!editingFlag && (
              <>
                <hr className="my-4" />
                <div className="flag-import-dropzone p-3 rounded border" onDrop={onDrop} onDragOver={onDragOver}>
                  <p className="mb-2 text-secondary">{importHint}</p>
                  <Form.Control
                    type="file"
                    accept=".txt"
                    multiple
                    onChange={handleInputImport}
                    disabled={isImporting}
                  />
                </div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              {t('managerCancel')}
            </Button>
            <Button variant="primary" type="submit">
              {editingFlag ? t('managerUpdate') : t('managerCreate')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{t('managerDelete')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{t('managerDeleteConfirm')}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            {t('managerCancel')}
          </Button>
          <Button variant="danger" onClick={() => void handleDelete()}>
            {t('managerDelete')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default FlagManager;
