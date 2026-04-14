import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import { getDatabase } from '../models/database';
import { TeamRow } from '../types';

function getJwtOptions(): SignOptions {
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return { expiresIn: expiresIn as SignOptions['expiresIn'] };
}

export function register(req: Request, res: Response): Response | void {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };

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
    function (this: sqlite3.RunResult, err: Error | null) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'Team name or email already exists' });
        }
        return res.status(500).json({ error: 'Registration failed' });
      }

      const token = jwt.sign(
        { id: this.lastID, name, email },
        process.env.JWT_SECRET as string,
        getJwtOptions()
      );

      res.status(201).json({
        message: 'Registration successful',
        token,
        team: { id: this.lastID, name, email, score: 0 }
      });
    }
  );
}

export function login(req: Request, res: Response): Response | void {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = getDatabase();

  db.get<TeamRow>('SELECT * FROM teams WHERE email = ?', [email], (err, team) => {
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
      process.env.JWT_SECRET as string,
      getJwtOptions()
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

export function getMe(req: Request, res: Response): Response | void {
  const db = getDatabase();
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  db.get<Omit<TeamRow, 'password'>>(
    'SELECT id, name, email, score, is_admin, created_at FROM teams WHERE id = ?',
    [userId],
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
