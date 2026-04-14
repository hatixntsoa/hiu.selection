const { getDatabase } = require('../models/database');

function getAllChallenges(req, res) {
  const db = getDatabase();
  const excludeFlag = req.query.includeFlag === 'true';

  const query = excludeFlag 
    ? 'SELECT * FROM challenges ORDER BY points ASC'
    : 'SELECT id, title, description, category, points, created_at FROM challenges ORDER BY points ASC';

  db.all(query, [], (err, challenges) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ challenges });
  });
}

function getChallengeById(req, res) {
  const db = getDatabase();
  const { id } = req.params;

  db.get('SELECT id, title, description, category, points, created_at FROM challenges WHERE id = ?', 
    [id], 
    (err, challenge) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!challenge) {
        return res.status(404).json({ error: 'Challenge not found' });
      }
      res.json({ challenge });
    }
  );
}

function createChallenge(req, res) {
  const { title, description, category, points, flag } = req.body;

  if (!title || !points || !flag) {
    return res.status(400).json({ error: 'Title, points, and flag are required' });
  }

  const db = getDatabase();

  db.run(
    'INSERT INTO challenges (title, description, category, points, flag) VALUES (?, ?, ?, ?, ?)',
    [title, description || '', category || '', points, flag],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create challenge' });
      }

      res.status(201).json({
        message: 'Challenge created',
        challenge: { id: this.lastID, title, description, category, points }
      });
    }
  );
}

function updateChallenge(req, res) {
  const { id } = req.params;
  const { title, description, category, points, flag } = req.body;

  const db = getDatabase();

  db.run(
    'UPDATE challenges SET title = COALESCE(?, title), description = COALESCE(?, description), category = COALESCE(?, category), points = COALESCE(?, points), flag = COALESCE(?, flag) WHERE id = ?',
    [title, description, category, points, flag, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update challenge' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Challenge not found' });
      }
      res.json({ message: 'Challenge updated' });
    }
  );
}

function deleteChallenge(req, res) {
  const { id } = req.params;
  const db = getDatabase();

  db.run('DELETE FROM challenges WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete challenge' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    res.json({ message: 'Challenge deleted' });
  });
}

module.exports = { 
  getAllChallenges, 
  getChallengeById, 
  createChallenge, 
  updateChallenge, 
  deleteChallenge 
};
