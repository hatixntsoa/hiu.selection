import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Button, Form, Modal, Table } from 'react-bootstrap';
import api from '../../services/api';
import { Challenge } from '../../types';

type ChallengeForm = {
  title: string;
  description: string;
  category: string;
  points: string;
  flag: string;
};

function ChallengeManager({ onChallengeChange }: { onChallengeChange?: () => void }): JSX.Element {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
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
  }, []);

  const fetchChallenges = async (): Promise<void> => {
    try {
      const response = await api.get('/challenges?includeFlag=true');
      setChallenges(response.data.challenges as Challenge[]);
    } catch (err) {
      console.error('Error fetching challenges:', err);
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
        setSuccess('Challenge updated successfully');
      } else {
        await api.post('/challenges', payload);
        setSuccess('Challenge created successfully');
      }
      handleCloseModal();
      await fetchChallenges();
      onChallengeChange?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save challenge');
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Are you sure you want to delete this challenge?')) {
      return;
    }

    try {
      await api.delete(`/challenges/${id}`);
      setSuccess('Challenge deleted successfully');
      await fetchChallenges();
      onChallengeChange?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete challenge');
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
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

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0 section-title">Manage Challenges</h5>
        <Button variant="primary" onClick={() => handleShowModal()}>
          + Add Challenge
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Table striped bordered hover responsive className="warm-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Category</th>
            <th>Points</th>
            <th>Flag</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {challenges.map((challenge) => (
            <tr key={challenge.id}>
              <td>{challenge.id}</td>
              <td>{challenge.title}</td>
              <td>
                <Badge bg={getCategoryColor(challenge.category)}>{challenge.category}</Badge>
              </td>
              <td>{challenge.points}</td>
              <td>
                <code>{challenge.flag}</code>
              </td>
              <td>
                <Button
                  variant="warning"
                  size="sm"
                  className="me-2"
                  onClick={() => handleShowModal(challenge)}
                >
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(challenge.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={handleCloseModal}>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editingChallenge ? 'Edit Challenge' : 'Add Challenge'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control type="text" name="title" value={formData.title} onChange={handleChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={3} name="description" value={formData.description} onChange={handleChange} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Category</Form.Label>
              <Form.Control
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="Web, Crypto, Reverse, etc."
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Points</Form.Label>
              <Form.Control type="number" name="points" value={formData.points} onChange={handleChange} required min="0" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Flag</Form.Label>
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
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingChallenge ? 'Update' : 'Create'} Challenge
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}

export default ChallengeManager;
