const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../models/database');

function register(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const db = getDatabase();
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO teams (name, email, password) VALUES (?, ?, ?)',
    [name, email, hashedPassword],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'Team name or email already exists' });
        }
        return res.status(500).json({ error: 'Registration failed' });
      }

      const token = jwt.sign(
        { id: this.lastID, name, email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.status(201).json({
        message: 'Registration successful',
        token,
        team: { id: this.lastID, name, email, score: 0 }
      });
    }
  );
}

function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = getDatabase();

  db.get('SELECT * FROM teams WHERE email = ?', [email], (err, team) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!team) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = bcrypt.compareSync(password, team.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: team.id, name: team.name, email: team.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token,
      team: {
        id: team.id,
        name: team.name,
        email: team.email,
        score: team.score,
        isAdmin: team.is_admin === 1
      }
    });
  });
}

function getMe(req, res) {
  const db = getDatabase();

  db.get('SELECT id, name, email, score, is_admin, created_at FROM teams WHERE id = ?', 
    [req.user.id], 
    (err, team) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      res.json({
        team: {
          ...team,
          isAdmin: team.is_admin === 1
        }
      });
    }
  );
}

module.exports = { register, login, getMe };
