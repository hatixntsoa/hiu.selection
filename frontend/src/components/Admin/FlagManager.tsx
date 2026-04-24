import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Form, Modal, Table } from 'react-bootstrap';
import api from '../../services/api';
import { Challenge, ChallengeCategoryType, ChallengeType, Difficulty } from '../../types';
import { usePreferences } from '../../context/PreferencesContext';
import { notify } from '../../services/notifications';

type FlagForm = {
  title: string;
  description: string;
  problem_formulation: string;
  flag: string;
  difficulty: Difficulty;
  challenge_type: ChallengeType;
  category: ChallengeCategoryType;
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

function normalizeChallengeType(value: unknown): ChallengeType {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'challenge' || normalized === 'vm') {
    return normalized;
  }
  return 'vm';
}

function normalizeChallengeCategory(value: unknown): ChallengeCategoryType {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'crypto' || normalized === 'forensics' || normalized === 'reverse' || normalized === 'pwn' || normalized === 'osint' || normalized === 'vm') {
    return normalized;
  }
  return 'vm';
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
    problem_formulation: '',
    flag: '',
    difficulty: 'easy',
    challenge_type: 'vm',
    category: 'vm',
    first_blood_points: '100',
    second_blood_points: '75',
    default_points: '50'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showFlags, setShowFlags] = useState(false);
  const xlsxImportInputRef = useRef<HTMLInputElement | null>(null);

  const importHint = useMemo(
    () => t('adminFlagsImportHint'),
    [t]
  );

  useEffect(() => {
    void fetchFlags();
  }, []);

  const fetchFlags = async (): Promise<void> => {
    try {
      const response = await api.get('/challenges', { params: { includeFlag: true, t: Date.now() } });
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
        problem_formulation: flagItem.problem_formulation || '',
        flag: flagItem.flag || '',
        difficulty: normalizeDifficulty(flagItem.difficulty),
        challenge_type: normalizeChallengeType(flagItem.challenge_type),
        category: normalizeChallengeCategory(flagItem.category),
        first_blood_points: String(flagItem.first_blood_points || 100),
        second_blood_points: String(flagItem.second_blood_points || 75),
        default_points: String(flagItem.default_points || 50)
      });
    } else {
      setEditingFlag(null);
      setFormData({
        title: '',
        description: '',
        problem_formulation: '',
        flag: '',
        difficulty: 'easy',
        challenge_type: 'vm',
        category: 'vm',
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
        problem_formulation: formData.problem_formulation.trim(),
        flag: formData.flag.trim(),
        difficulty: formData.difficulty,
        challenge_type: formData.challenge_type,
        category: formData.challenge_type === 'vm' ? 'vm' : formData.category,
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

  const handleCopyFlag = async (flagValue: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(flagValue);
      notify('success', t('adminFlagsCopied'));
      setSuccess(t('adminFlagsCopied'));
      setError('');
    } catch {
      notify('error', t('adminFlagsCopyFailed'));
      setError(t('adminFlagsCopyFailed'));
    }
  };

  const handleOpenXlsxImport = (): void => {
    if (isImporting) {
      return;
    }
    xlsxImportInputRef.current?.click();
  };

  const handleXlsxImportChange = (e: ChangeEvent<HTMLInputElement>): void => {
    void (async () => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) {
        return;
      }
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        setError(t('adminFlagsImportXlsxOnly'));
        setSuccess('');
        return;
      }

      setIsImporting(true);
      setError('');
      setSuccess('');

      try {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
        if (!firstSheet) {
          setError(t('adminFlagsImportNoValid'));
          return;
        }

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
        const normalizedRows = rows
          .map((row) => {
            const challengeType = normalizeChallengeType(row.TYPE);
            const difficulty = normalizeDifficulty(row.DIFFICULTY);
            const defaults = DIFFICULTY_DEFAULT_POINTS[difficulty];
            const category = challengeType === 'vm' ? 'vm' : normalizeChallengeCategory(row.CATEGORY || 'crypto');
            return {
              title: String(row.TITLE || '').trim(),
              description: String(row.DESCRIPTION || '').trim(),
              problem_formulation: String(row.FORMULATION || '').trim(),
              flag: String(row.FLAG || '').trim(),
              challenge_type: challengeType,
              category,
              difficulty,
              first_blood_points: defaults.first,
              second_blood_points: defaults.second,
              default_points: defaults.third
            };
          })
          .filter((row) => row.flag.length > 0);

        if (normalizedRows.length === 0) {
          setError(t('adminFlagsImportNoValid'));
          return;
        }

        const existingFlagsResponse = await api.get('/challenges', { params: { includeFlag: true, t: Date.now() } });
        const existingFlags = existingFlagsResponse.data.challenges as Challenge[];
        for (const item of existingFlags) {
          await api.delete(`/challenges/${item.id}`);
        }
        for (const payload of normalizedRows) {
          await api.post('/challenges', payload);
        }

        setSuccess(t('adminFlagsImported', { count: normalizedRows.length }));
        await fetchFlags();
        onFlagChange?.();
      } catch (err: any) {
        setError(localizeApiMessage(err.response?.data?.error || t('adminFlagsImportFailed')));
      } finally {
        setIsImporting(false);
      }
    })();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <h5 className="mb-0 section-title">{t('adminFlagsTitle')}</h5>
          <span className="badge rounded-pill text-bg-primary">{flags.length}</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <input ref={xlsxImportInputRef} type="file" accept=".xlsx" className="d-none" onChange={handleXlsxImportChange} />
          <Button
            variant={isImporting ? 'secondary' : 'outline-primary'}
            onClick={handleOpenXlsxImport}
            disabled={isImporting}
            className={isImporting ? 'btn-pressed-grey' : undefined}
          >
            {isImporting ? t('adminFlagsImporting') : t('adminFlagsImportXlsx')}
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => setShowFlags((prev) => !prev)}
            aria-label={showFlags ? t('hidePassword') : t('showPassword')}
            title={showFlags ? t('hidePassword') : t('showPassword')}
          >
            {showFlags ? '🙈' : '👁'}
          </Button>
          <Button variant="primary" onClick={() => handleShowModal()}>
            {t('adminFlagsAdd')}
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Table striped bordered hover responsive className="warm-table admin-flags-table">
        <thead>
          <tr>
            <th>{t('managerTableId')}</th>
            <th className="flags-col-title">{t('managerFieldTitle')}</th>
            <th className="flags-col-description">{t('managerFieldDescription')}</th>
            <th className="flags-col-flag">{t('managerTableFlag')}</th>
            <th>{t('managerTableType')}</th>
            <th>{t('managerTableDifficulty')}</th>
            <th>{t('managerTablePoints')}</th>
            <th className="flags-col-actions">{t('managerTableActions')}</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((item) => (
            <tr key={item.id}>
              <td><code>{item.public_id || item.id}</code></td>
              <td className="flags-col-title"><span className="flags-row-text-ellipsis">{item.title || '-'}</span></td>
              <td className="flags-col-description"><span className="flags-row-text-ellipsis">{item.description || '-'}</span></td>
              <td className="flags-col-flag">
                <code
                  className={`flag-cell-code ${showFlags ? 'is-revealed' : ''}`}
                  onClick={() => {
                    if (showFlags && item.flag) {
                      void handleCopyFlag(item.flag);
                    }
                  }}
                  title={showFlags ? item.flag || '' : ''}
                  role={showFlags ? 'button' : undefined}
                  tabIndex={showFlags ? 0 : -1}
                  onKeyDown={(event) => {
                    if (showFlags && item.flag && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      void handleCopyFlag(item.flag);
                    }
                  }}
                >
                  {showFlags ? item.flag : '••••••••••••••••••••'}
                </code>
              </td>
              <td>{item.challenge_type === 'challenge' ? t('challengeTypeChallenge') : t('challengeTypeVM')}</td>
              <td>{t(difficultyLabelKey(normalizeDifficulty(item.difficulty)))}</td>
              <td>{Math.max(Number(item.first_blood_points) || 100, Number(item.second_blood_points) || 75, Number(item.default_points) || 50)}</td>
              <td className="flags-col-actions">
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
              <Form.Label>{t('dashboardProblemFormulation')}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.problem_formulation}
                onChange={(e) => setFormData((prev) => ({ ...prev, problem_formulation: e.target.value }))}
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
              <Form.Label>{t('managerFieldType')}</Form.Label>
              <Form.Select
                value={formData.challenge_type}
                onChange={(e) => {
                  const challengeType = normalizeChallengeType(e.target.value);
                  setFormData((prev) => ({
                    ...prev,
                    challenge_type: challengeType,
                    category: challengeType === 'vm' ? 'vm' : prev.category === 'vm' ? 'crypto' : prev.category
                  }));
                }}
              >
                <option value="vm">{t('challengeTypeVM')}</option>
                <option value="challenge">{t('challengeTypeChallenge')}</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('managerFieldCategory')}</Form.Label>
              <Form.Select
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: normalizeChallengeCategory(e.target.value) }))}
                disabled={formData.challenge_type === 'vm'}
              >
                {formData.challenge_type === 'vm' ? (
                  <option value="vm">{t('challengeCategoryVM')}</option>
                ) : (
                  <>
                    <option value="crypto">{t('challengeCategoryCrypto')}</option>
                    <option value="forensics">{t('challengeCategoryForensics')}</option>
                    <option value="reverse">{t('challengeCategoryReverse')}</option>
                    <option value="pwn">{t('challengeCategoryPwn')}</option>
                    <option value="osint">{t('challengeCategoryOsint')}</option>
                  </>
                )}
              </Form.Select>
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
