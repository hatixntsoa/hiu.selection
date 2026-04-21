import { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import { getDatabase } from '../models/database';
import { ChallengeDifficulty, ChallengeRow } from '../types';
import { logAction } from '../utils/action-logger';

type FlagInput = {
  title?: string;
  description?: string;
  flag?: string;
  difficulty?: ChallengeDifficulty;
  first_blood_points?: number;
  second_blood_points?: number;
  default_points?: number;
};

type FlagImportItem = {
  flag?: string;
};

const DIFFICULTY_POINTS: Record<ChallengeDifficulty, { first: number; second: number; third: number }> = {
  easy: { first: 100, second: 75, third: 50 },
  medium: { first: 200, second: 150, third: 100 },
  hard: { first: 300, second: 225, third: 150 }
};
const DEFAULT_DIFFICULTY: ChallengeDifficulty = 'easy';

function normalizePositiveInt(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }
  return Math.floor(number);
}

function normalizeDifficulty(value: unknown, fallback: ChallengeDifficulty = DEFAULT_DIFFICULTY): ChallengeDifficulty {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard') {
    return normalized;
  }
  return fallback;
}

function generatePublicId(): string {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function createFlagWithRetry(
  db: sqlite3.Database,
  input: {
    title: string;
    description: string;
    flag: string;
    difficulty: ChallengeDifficulty;
    firstBloodPoints: number;
    secondBloodPoints: number;
    defaultPoints: number;
  },
  maxAttempts: number,
  done: (err: Error | null, result?: { id: number; publicId: string }) => void
): void {
  let attempts = 0;
  const attempt = (): void => {
    attempts += 1;
    const publicId = generatePublicId();
    db.run(
      `INSERT INTO challenges (
         public_id, title, description, flag, difficulty, first_blood_points, second_blood_points, default_points
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        publicId,
        input.title,
        input.description,
        input.flag,
        input.difficulty,
        input.firstBloodPoints,
        input.secondBloodPoints,
        input.defaultPoints
      ],
      function (this: sqlite3.RunResult, err: Error | null) {
        if (!err) {
          done(null, { id: this.lastID, publicId });
          return;
        }
        if (String(err.message || '').includes('UNIQUE') && attempts < maxAttempts) {
          attempt();
          return;
        }
        done(err);
      }
    );
  };
  attempt();
}

export function getAllChallenges(req: Request, res: Response): Response | void {
  const db = getDatabase();
  const includeFlag = req.query.includeFlag === 'true';
  const query = includeFlag
    ? `SELECT id, public_id, title, description, flag, difficulty, first_blood_points, second_blood_points, default_points, created_at
        FROM challenges ORDER BY created_at DESC, id DESC`
    : `SELECT id, public_id, title, description, difficulty, first_blood_points, second_blood_points, default_points, created_at
        FROM challenges ORDER BY created_at DESC, id DESC`;

  db.all<ChallengeRow>(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.json({ challenges: rows });
  });
}

export function getChallengeById(req: Request, res: Response): Response | void {
  const db = getDatabase();
  const { id } = req.params;
  db.get<ChallengeRow>(
    `SELECT id, public_id, title, description, difficulty, first_blood_points, second_blood_points, default_points, created_at
     FROM challenges WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Challenge not found' });
      }
      return res.json({ challenge: row });
    }
  );
}

export function createChallenge(req: Request, res: Response): Response | void {
  const payload = req.body as FlagInput;
  const flagValue = (payload.flag || '').trim();
  if (!flagValue) {
    return res.status(400).json({ error: 'Flag value is required' });
  }
  const db = getDatabase();
  const difficulty = normalizeDifficulty(payload.difficulty, DEFAULT_DIFFICULTY);
  const difficultyDefaults = DIFFICULTY_POINTS[difficulty];
  const input = {
    title: (payload.title || '').trim(),
    description: (payload.description || '').trim(),
    flag: flagValue,
    difficulty,
    firstBloodPoints: normalizePositiveInt(payload.first_blood_points, difficultyDefaults.first),
    secondBloodPoints: normalizePositiveInt(payload.second_blood_points, difficultyDefaults.second),
    defaultPoints: normalizePositiveInt(payload.default_points, difficultyDefaults.third)
  };
  createFlagWithRetry(db, input, 10, (err, result) => {
    if (err || !result) {
      return res.status(500).json({ error: 'Failed to create challenge' });
    }
    logAction('challenge.create', `id=${result.id} public_id=${result.publicId}`);
    return res.status(201).json({
      message: 'Challenge created',
      challenge: {
        id: result.id,
        public_id: result.publicId,
        title: input.title,
        description: input.description,
        difficulty: input.difficulty,
        first_blood_points: input.firstBloodPoints,
        second_blood_points: input.secondBloodPoints,
        default_points: input.defaultPoints
      }
    });
  });
}

export function updateChallenge(req: Request, res: Response): Response | void {
  const { id } = req.params;
  const payload = req.body as FlagInput;
  const db = getDatabase();
  const updates: Array<{ sql: string; value: unknown }> = [];

  if (typeof payload.title !== 'undefined') {
    updates.push({ sql: 'title = ?', value: String(payload.title).trim() });
  }
  if (typeof payload.description !== 'undefined') {
    updates.push({ sql: 'description = ?', value: String(payload.description).trim() });
  }
  if (typeof payload.flag !== 'undefined') {
    const flag = String(payload.flag).trim();
    if (!flag) {
      return res.status(400).json({ error: 'Flag value is required' });
    }
    updates.push({ sql: 'flag = ?', value: flag });
  }
  if (typeof payload.difficulty !== 'undefined') {
    updates.push({ sql: 'difficulty = ?', value: normalizeDifficulty(payload.difficulty, DEFAULT_DIFFICULTY) });
  }
  if (typeof payload.first_blood_points !== 'undefined') {
    updates.push({
      sql: 'first_blood_points = ?',
      value: normalizePositiveInt(payload.first_blood_points, DIFFICULTY_POINTS[DEFAULT_DIFFICULTY].first)
    });
  }
  if (typeof payload.second_blood_points !== 'undefined') {
    updates.push({
      sql: 'second_blood_points = ?',
      value: normalizePositiveInt(payload.second_blood_points, DIFFICULTY_POINTS[DEFAULT_DIFFICULTY].second)
    });
  }
  if (typeof payload.default_points !== 'undefined') {
    updates.push({
      sql: 'default_points = ?',
      value: normalizePositiveInt(payload.default_points, DIFFICULTY_POINTS[DEFAULT_DIFFICULTY].third)
    });
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  const query = `UPDATE challenges SET ${updates.map((u) => u.sql).join(', ')} WHERE id = ?`;
  const values = updates.map((u) => u.value);
  values.push(id);
  db.run(query, values, function (this: sqlite3.RunResult, err: Error | null) {
    if (err) {
      return res.status(500).json({ error: 'Failed to update challenge' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    logAction('challenge.update', `id=${id}`);
    return res.json({ message: 'Challenge updated' });
  });
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
    logAction('challenge.delete', `id=${id}`);
    return res.json({ message: 'Challenge deleted' });
  });
}

export function getCategories(_req: Request, res: Response): Response | void {
  return res.json({ categories: [] });
}

export function createCategory(_req: Request, res: Response): Response | void {
  return res.status(410).json({ error: 'Category management removed' });
}

export function importFlags(req: Request, res: Response): Response | void {
  const payload = req.body as { flags?: FlagImportItem[] };
  const rawItems = Array.isArray(payload.flags) ? payload.flags : [];
  const normalizedFlags = rawItems
    .map((item) => String(item?.flag || '').trim())
    .filter((value) => value.length > 0);

  if (normalizedFlags.length === 0) {
    return res.status(400).json({ error: 'At least one valid flag is required' });
  }

  const db = getDatabase();
  const created: Array<{ id: number; public_id: string }> = [];
  let index = 0;
  const next = (): void => {
    if (index >= normalizedFlags.length) {
      res.status(201).json({
        message: 'Flags imported',
        count: created.length,
        flags: created
      });
      logAction('challenge.import', `count=${created.length}`);
      return;
    }
    const flag = normalizedFlags[index];
    index += 1;
    createFlagWithRetry(
      db,
      {
        title: '',
        description: '',
        flag,
        difficulty: DEFAULT_DIFFICULTY,
        firstBloodPoints: DIFFICULTY_POINTS[DEFAULT_DIFFICULTY].first,
        secondBloodPoints: DIFFICULTY_POINTS[DEFAULT_DIFFICULTY].second,
        defaultPoints: DIFFICULTY_POINTS[DEFAULT_DIFFICULTY].third
      },
      10,
      (err, result) => {
        if (err || !result) {
          res.status(500).json({ error: 'Failed to create challenge' });
          return;
        }
        created.push({ id: result.id, public_id: result.publicId });
        next();
      }
    );
  };
  next();
}
