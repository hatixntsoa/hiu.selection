import { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import { getDatabase } from '../models/database';
import { ChallengeRow } from '../types';

type ChallengeInput = {
  title?: string;
  description?: string;
  category?: string;
  points?: number;
  flag?: string;
};

export function getAllChallenges(req: Request, res: Response): Response | void {
  const db = getDatabase();
  const includeFlag = req.query.includeFlag === 'true';

  const query = includeFlag
    ? 'SELECT * FROM challenges ORDER BY points ASC'
    : 'SELECT id, title, description, category, points, created_at FROM challenges ORDER BY points ASC';

  db.all<ChallengeRow>(query, [], (err, challenges) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ challenges });
  });
}

export function getChallengeById(req: Request, res: Response): Response | void {
  const db = getDatabase();
  const { id } = req.params;

  db.get<ChallengeRow>(
    'SELECT id, title, description, category, points, created_at FROM challenges WHERE id = ?',
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

export function createChallenge(req: Request, res: Response): Response | void {
  const { title, description, category, points, flag } = req.body as ChallengeInput;

  if (!title || !points || !flag) {
    return res.status(400).json({ error: 'Title, points, and flag are required' });
  }

  const db = getDatabase();

  db.run(
    'INSERT INTO challenges (title, description, category, points, flag) VALUES (?, ?, ?, ?, ?)',
    [title, description || '', category || '', points, flag],
    function (this: sqlite3.RunResult, err: Error | null) {
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

export function updateChallenge(req: Request, res: Response): Response | void {
  const { id } = req.params;
  const { title, description, category, points, flag } = req.body as ChallengeInput;
  const db = getDatabase();

  db.run(
    'UPDATE challenges SET title = COALESCE(?, title), description = COALESCE(?, description), category = COALESCE(?, category), points = COALESCE(?, points), flag = COALESCE(?, flag) WHERE id = ?',
    [title, description, category, points, flag, id],
    function (this: sqlite3.RunResult, err: Error | null) {
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

export function deleteChallenge(req: Request, res: Response): Response | void {
  const { id } = req.params;
  const db = getDatabase();

  db.run('DELETE FROM challenges WHERE id = ?', [id], function (this: sqlite3.RunResult, err: Error | null) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete challenge' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    res.json({ message: 'Challenge deleted' });
  });
}
