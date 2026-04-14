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

type CategoryRow = {
  id: number;
  name: string;
  created_at: string;
};

const DEFAULT_CATEGORIES = ['Web', 'Crypto', 'Reverse', 'Misc', 'SQL', 'Forensics'];

function ensureDefaultCategories(db: sqlite3.Database, done: (err?: Error | null) => void): void {
  let remaining = DEFAULT_CATEGORIES.length;
  let finished = false;
  if (remaining === 0) {
    done();
    return;
  }

  DEFAULT_CATEGORIES.forEach((category) => {
    db.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [category], (err) => {
      if (finished) {
        return;
      }
      if (err) {
        finished = true;
        done(err);
        return;
      }
      remaining -= 1;
      if (remaining === 0) {
        finished = true;
        done();
      }
    });
  });
}

function normalizeCategoryForCode(category: string): string {
  const normalized = category.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return normalized || 'misc';
}

function withChallengeCodes(challenges: ChallengeRow[]): Array<ChallengeRow & { challenge_code: string }> {
  const categoryCounts = new Map<string, number>();
  return challenges.map((challenge) => {
    const bucket = normalizeCategoryForCode(challenge.category || 'misc');
    const next = (categoryCounts.get(bucket) || 0) + 1;
    categoryCounts.set(bucket, next);
    return { ...challenge, challenge_code: `${bucket}#${next}` };
  });
}

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
    res.json({ challenges: withChallengeCodes(challenges) });
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
      res.json({ challenge: withChallengeCodes([challenge])[0] });
    }
  );
}

export function createChallenge(req: Request, res: Response): Response | void {
  const { title, description, category, points, flag } = req.body as ChallengeInput;

  if (!title || !points || !flag || !category) {
    return res.status(400).json({ error: 'Title, category, points, and flag are required' });
  }

  const db = getDatabase();
  ensureDefaultCategories(db, (seedErr) => {
    if (seedErr) {
      return res.status(500).json({ error: 'Database error' });
    }

    db.get<{ id: number }>(
      'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
      [category],
      (categoryErr, categoryRow) => {
        if (categoryErr) {
          return res.status(500).json({ error: 'Database error' });
        }
        if (!categoryRow) {
          return res.status(400).json({ error: 'Invalid challenge category' });
        }

        db.run(
          'INSERT INTO challenges (title, description, category, points, flag) VALUES (?, ?, ?, ?, ?)',
          [title, description || '', category, points, flag],
          function (this: sqlite3.RunResult, err: Error | null) {
            if (err) {
              return res.status(500).json({ error: 'Failed to create challenge' });
            }

            return res.status(201).json({
              message: 'Challenge created',
              challenge: { id: this.lastID, title, description, category, points }
            });
          }
        );
      }
    );
  });
}

export function getCategories(_req: Request, res: Response): Response | void {
  const db = getDatabase();
  ensureDefaultCategories(db, (seedErr) => {
    if (seedErr) {
      return res.status(500).json({ error: 'Database error' });
    }
    db.all<CategoryRow>('SELECT id, name, created_at FROM categories ORDER BY name COLLATE NOCASE ASC', [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      return res.json({ categories: rows });
    });
  });
}

type CategoryInput = {
  name?: string;
};

export function createCategory(req: Request, res: Response): Response | void {
  const { name } = req.body as CategoryInput;
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const db = getDatabase();
  db.run('INSERT INTO categories (name) VALUES (?)', [trimmed], function (this: sqlite3.RunResult, err: Error | null) {
    if (err) {
      if ((err as any).message?.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Category already exists' });
      }
      return res.status(500).json({ error: 'Failed to create category' });
    }
    return res.status(201).json({
      message: 'Category created',
      category: { id: this.lastID, name: trimmed }
    });
  });
}

function updateChallengeDirect(
  db: sqlite3.Database,
  id: string,
  input: ChallengeInput,
  res: Response
): Response | void {
  db.run(
    'UPDATE challenges SET title = COALESCE(?, title), description = COALESCE(?, description), category = COALESCE(?, category), points = COALESCE(?, points), flag = COALESCE(?, flag) WHERE id = ?',
    [input.title, input.description, input.category, input.points, input.flag, id],
    function (this: sqlite3.RunResult, err: Error | null) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update challenge' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Challenge not found' });
      }
      return res.json({ message: 'Challenge updated' });
    }
  );
}

export function updateChallenge(req: Request, res: Response): Response | void {
  const id = String(req.params.id);
  const input = req.body as ChallengeInput;
  const db = getDatabase();

  if (input.category) {
    db.get<{ id: number }>('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [input.category], (categoryErr, row) => {
      if (categoryErr) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) {
        return res.status(400).json({ error: 'Invalid challenge category' });
      }
      return updateChallengeDirect(db, id, input, res);
    });
    return;
  }

  return updateChallengeDirect(db, id, input, res);
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
    return res.json({ message: 'Challenge deleted' });
  });
}
