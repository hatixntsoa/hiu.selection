import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Button, Form, Modal, Table } from 'react-bootstrap';
import api from '../../services/api';
import { Challenge, ChallengeCategory } from '../../types';
import { usePreferences } from '../../context/PreferencesContext';

type ChallengeForm = {
  title: string;
  description: string;
  category: string;
  points: string;
  flag: string;
};

const DEFAULT_CATEGORY_NAMES = ['Web', 'Crypto', 'Reverse', 'Misc', 'SQL', 'Forensics'];

function ChallengeManager({ onChallengeChange }: { onChallengeChange?: () => void }): JSX.Element {
  const { t, localizeApiMessage } = usePreferences();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [deletingChallenge, setDeletingChallenge] = useState<Challenge | null>(null);
  const [categories, setCategories] = useState<ChallengeCategory[]>(
    DEFAULT_CATEGORY_NAMES.map((name, index) => ({ id: index + 1, name }))
  );
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formData, setFormData] = useState<ChallengeForm>({
    title: '',
    description: '',
    category: '',
    points: '',
    flag: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchChallenges();
    fetchCategories();
  }, []);

  const fetchChallenges = async (): Promise<void> => {
    try {
      const response = await api.get('/challenges?includeFlag=true');
      setChallenges(response.data.challenges as Challenge[]);
    } catch (err) {
      console.error('Error fetching challenges:', err);
    }
  };

  const fetchCategories = async (): Promise<void> => {
    try {
      const response = await api.get('/challenges/categories');
      const rows = response.data.categories as ChallengeCategory[];
      if (rows.length > 0) {
        setCategories(rows);
      } else {
        setCategories(DEFAULT_CATEGORY_NAMES.map((name, index) => ({ id: index + 1, name })));
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setCategories(DEFAULT_CATEGORY_NAMES.map((name, index) => ({ id: index + 1, name })));
    }
  };

  const handleShowModal = (challenge: Challenge | null = null): void => {
    if (challenge) {
      setEditingChallenge(challenge);
      setFormData({
        title: challenge.title,
        description: challenge.description,
        category: challenge.category,
        points: String(challenge.points),
        flag: challenge.flag || ''
      });
    } else {
      setEditingChallenge(null);
      setFormData({ title: '', description: '', category: '', points: '', flag: '' });
    }
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const handleCloseModal = (): void => {
    setShowModal(false);
    setEditingChallenge(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const payload = { ...formData, points: Number(formData.points) };
      if (editingChallenge) {
        await api.put(`/challenges/${editingChallenge.id}`, payload);
        setSuccess(t('managerSavedUpdated'));
      } else {
        await api.post('/challenges', payload);
        setSuccess(t('managerSavedCreated'));
      }
      handleCloseModal();
      await fetchChallenges();
      onChallengeChange?.();
    } catch (err: any) {
      setError(localizeApiMessage(err.response?.data?.error || t('managerSaveFailed')));
    }
  };

  const handleCreateCategory = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/challenges/categories', { name: newCategoryName.trim() });
      setSuccess(t('managerCategoryCreated'));
      setNewCategoryName('');
      setShowCategoryModal(false);
      await fetchCategories();
    } catch (err: any) {
      setError(localizeApiMessage(err.response?.data?.error || t('managerCategoryCreateFailed')));
    }
  };

  const handleOpenDeleteModal = (challenge: Challenge): void => {
    setDeletingChallenge(challenge);
    setShowDeleteModal(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (): Promise<void> => {
    if (!deletingChallenge) {
      return;
    }
    try {
      await api.delete(`/challenges/${deletingChallenge.id}`);
      setSuccess(t('managerDeleted'));
      await fetchChallenges();
      onChallengeChange?.();
      setShowDeleteModal(false);
      setDeletingChallenge(null);
    } catch (err: any) {
      setError(localizeApiMessage(err.response?.data?.error || t('managerDeleteFailed')));
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      Web: 'primary',
      Crypto: 'warning',
      Reverse: 'danger',
      Misc: 'info',
      SQL: 'success',
      Forensics: 'secondary'
    };
    return colors[category] || 'secondary';
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      Web: t('categoryWeb'),
      Crypto: t('categoryCrypto'),
      Reverse: t('categoryReverse'),
      Misc: t('categoryMisc'),
      SQL: t('categorySQL'),
      Forensics: t('categoryForensics')
    };
    return labels[category] || category;
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0 section-title">{t('managerTitle')}</h5>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={() => setShowCategoryModal(true)}>
            {t('managerManageCategories')}
          </Button>
          <Button variant="primary" onClick={() => handleShowModal()}>
            {t('managerAddChallenge')}
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Table striped bordered hover responsive className="warm-table">
        <thead>
          <tr>
            <th>{t('managerTableId')}</th>
            <th>{t('managerTableTitle')}</th>
            <th>{t('managerTableCategory')}</th>
            <th>{t('managerTablePoints')}</th>
            <th>{t('managerTableFlag')}</th>
            <th>{t('managerTableActions')}</th>
          </tr>
        </thead>
        <tbody>
          {challenges.map((challenge) => (
            <tr key={challenge.id}>
              <td>{challenge.challenge_code || challenge.id}</td>
              <td>{challenge.title}</td>
              <td>
                <Badge bg={getCategoryColor(challenge.category)}>{getCategoryLabel(challenge.category)}</Badge>
              </td>
              <td>{challenge.points}</td>
              <td>
                <code>{challenge.flag}</code>
              </td>
              <td>
                <Button
                  variant="success"
                  size="sm"
                  className="me-2"
                  onClick={() => handleShowModal(challenge)}
                >
                  {t('managerEdit')}
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleOpenDeleteModal(challenge)}>
                  {t('managerDelete')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={handleCloseModal}>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editingChallenge ? t('managerModalEdit') : t('managerModalAdd')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('managerFieldTitle')}</Form.Label>
              <Form.Control type="text" name="title" value={formData.title} onChange={handleChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('managerFieldDescription')}</Form.Label>
              <Form.Control as="textarea" rows={3} name="description" value={formData.description} onChange={handleChange} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('managerFieldCategory')}</Form.Label>
              <Form.Select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="">{t('managerCategorySelect')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {getCategoryLabel(category.name)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('managerFieldPoints')}</Form.Label>
              <Form.Control type="number" name="points" value={formData.points} onChange={handleChange} required min="0" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('managerFieldFlag')}</Form.Label>
              <Form.Control
                type="text"
                name="flag"
                value={formData.flag}
                onChange={handleChange}
                placeholder="flag{...}"
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              {t('managerCancel')}
            </Button>
            <Button variant="primary" type="submit">
              {editingChallenge ? t('managerUpdate') : t('managerCreate')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={showDeleteModal}
        onHide={() => {
          setShowDeleteModal(false);
          setDeletingChallenge(null);
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>{t('managerDelete')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">{t('managerDeleteConfirm')}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowDeleteModal(false);
              setDeletingChallenge(null);
            }}
          >
            {t('managerCancel')}
          </Button>
          <Button variant="danger" onClick={() => handleDelete()}>
            {t('managerDelete')}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showCategoryModal}
        onHide={() => {
          setShowCategoryModal(false);
          setNewCategoryName('');
        }}
      >
        <Form onSubmit={handleCreateCategory}>
          <Modal.Header closeButton>
            <Modal.Title>{t('managerManageCategories')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('managerCategoryName')}</Form.Label>
              <Form.Control
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                required
              />
            </Form.Group>
            <div className="d-flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge key={category.id} bg={getCategoryColor(category.name)}>
                  {getCategoryLabel(category.name)}
                </Badge>
              ))}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCategoryModal(false);
                setNewCategoryName('');
              }}
            >
              {t('managerCancel')}
            </Button>
            <Button type="submit" variant="primary">
              {t('managerCreateCategory')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}

export default ChallengeManager;
