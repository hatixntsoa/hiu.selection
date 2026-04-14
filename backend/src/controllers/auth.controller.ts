import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import { getDatabase } from '../models/database';
import { TeamRow } from '../types';

const MAX_TEAM_MEMBERS = 6;

function getJwtOptions(): SignOptions {
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return { expiresIn: expiresIn as SignOptions['expiresIn'] };
}

export function register(req: Request, res: Response): Response | void {
  const { name, password } = req.body as { name?: string; password?: string };

  if (!name || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const db = getDatabase();
  const trimmedName = name.trim();
  const syntheticEmail = `${trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}@ctf.local`;

  db.get<TeamRow>('SELECT * FROM teams WHERE name = ?', [trimmedName], (lookupErr, existingTeam) => {
    if (lookupErr) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingTeam) {
      const isValid = bcrypt.compareSync(password, existingTeam.password);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (existingTeam.member_count >= MAX_TEAM_MEMBERS) {
        return res.status(400).json({ error: 'Team has reached the maximum of 6 members' });
      }

      db.run('UPDATE teams SET member_count = member_count + 1 WHERE id = ?', [existingTeam.id], (incErr) => {
        if (incErr) {
          return res.status(500).json({ error: 'Registration failed' });
        }
        const token = jwt.sign(
          { id: existingTeam.id, name: existingTeam.name },
          process.env.JWT_SECRET as string,
          getJwtOptions()
        );
        return res.status(201).json({
          message: 'Registration successful',
          token,
          team: {
            id: existingTeam.id,
            name: existingTeam.name,
            score: existingTeam.score,
            isAdmin: existingTeam.is_admin === 1
          }
        });
      });
      return;
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(
      'INSERT INTO teams (name, email, password, member_count) VALUES (?, ?, ?, 1)',
      [trimmedName, syntheticEmail, hashedPassword],
      function (this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          if (err.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Username already exists' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }

        const token = jwt.sign(
          { id: this.lastID, name: trimmedName },
          process.env.JWT_SECRET as string,
          getJwtOptions()
        );

        return res.status(201).json({
          message: 'Registration successful',
          token,
          team: { id: this.lastID, name: trimmedName, score: 0 }
        });
      }
    );
  });
}

export function login(req: Request, res: Response): Response | void {
  const { name, password } = req.body as { name?: string; password?: string };

  if (!name || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const db = getDatabase();

  db.get<TeamRow>('SELECT * FROM teams WHERE name = ?', [name], (err, team) => {
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
      { id: team.id, name: team.name },
      process.env.JWT_SECRET as string,
      getJwtOptions()
    );

    res.json({
      message: 'Login successful',
      token,
      team: {
        id: team.id,
        name: team.name,
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
    'SELECT id, name, email, score, member_count, is_admin, created_at FROM teams WHERE id = ?',
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
