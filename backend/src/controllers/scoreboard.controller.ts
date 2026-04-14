import { Request, Response } from 'express';
import { getDatabase } from '../models/database';
import {
  addTimerSeconds,
  getCtfTimerState,
  restartFiniteTimer,
  setFiniteDuration,
  setInfiniteTimer
} from '../models/timer';

type ScoreboardTeam = {
  id: number;
  name: string;
  score: number;
  created_at: string;
};

type ActivityRow = {
  submitted_at: string;
  team_name: string;
  challenge_title: string;
  points: number;
};

type CountRow = { total: number };
type HighestScoreRow = { highest_score: number | null };

export function getScoreboard(_req: Request, res: Response): Response | void {
  const db = getDatabase();

  db.all<ScoreboardTeam>(
    'SELECT id, name, score, created_at FROM teams WHERE is_admin = 0 ORDER BY score DESC, created_at ASC',
    [],
    (err, teams) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const scoreboard = teams.map((team, index) => ({
        ...team,
        rank: index + 1
      }));

      res.json({ scoreboard });
    }
  );
}

export function getActivityFeed(_req: Request, res: Response): Response | void {
  const db = getDatabase();

  db.all<ActivityRow>(
    `SELECT s.submitted_at, t.name as team_name, c.title as challenge_title, c.points
     FROM submissions s
     JOIN teams t ON s.team_id = t.id
     JOIN challenges c ON s.challenge_id = c.id
     WHERE s.is_correct = 1
     ORDER BY s.submitted_at DESC
     LIMIT 20`,
    [],
    (err, activities) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ activities });
    }
  );
}

export function getStats(_req: Request, res: Response): void {
  const db = getDatabase();
  const stats: Record<string, number> = {};

  db.get<CountRow>('SELECT COUNT(*) as total FROM teams WHERE is_admin = 0', [], (_err1, teamsRow) => {
    stats.totalTeams = teamsRow?.total || 0;

    db.get<CountRow>('SELECT COUNT(*) as total FROM challenges', [], (_err2, challengesRow) => {
      stats.totalChallenges = challengesRow?.total || 0;

      db.get<CountRow>('SELECT COUNT(*) as total FROM submissions WHERE is_correct = 1', [], (_err3, solvesRow) => {
        stats.totalSolves = solvesRow?.total || 0;

        db.get<HighestScoreRow>(
          'SELECT MAX(score) as highest_score FROM teams WHERE is_admin = 0',
          [],
          (_err4, highestRow) => {
            stats.highestScore = highestRow?.highest_score || 0;
            res.json({ stats });
          }
        );
      });
    });
  });
}

type TimerRequestBody = {
  durationSeconds?: number;
  seconds?: number;
};

export async function getTimer(_req: Request, res: Response): Promise<Response> {
  try {
    const timer = await getCtfTimerState();
    return res.json({ timer });
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
}

export async function updateTimerDuration(req: Request, res: Response): Promise<Response> {
  const { durationSeconds } = req.body as TimerRequestBody;
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) {
    return res.status(400).json({ error: 'Duration in seconds is required' });
  }

  try {
    const timer = await setFiniteDuration(durationSeconds);
    return res.json({ message: 'CTF timer duration updated', timer });
  } catch {
    return res.status(500).json({ error: 'Failed to update timer duration' });
  }
}

export async function restartTimer(req: Request, res: Response): Promise<Response> {
  const { durationSeconds } = req.body as TimerRequestBody;
  if (typeof durationSeconds !== 'undefined' && (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds))) {
    return res.status(400).json({ error: 'Duration must be a valid number of seconds' });
  }

  try {
    const timer = await restartFiniteTimer(durationSeconds);
    return res.json({ message: 'CTF timer restarted', timer });
  } catch {
    return res.status(500).json({ error: 'Failed to restart timer' });
  }
}

export async function addTimeToTimer(req: Request, res: Response): Promise<Response> {
  const { seconds } = req.body as TimerRequestBody;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return res.status(400).json({ error: 'Positive seconds value is required' });
  }

  try {
    const timer = await addTimerSeconds(seconds);
    return res.json({ message: 'Time added to CTF timer', timer });
  } catch {
    return res.status(500).json({ error: 'Failed to add time to timer' });
  }
}

export async function makeTimerInfinite(_req: Request, res: Response): Promise<Response> {
  try {
    const timer = await setInfiniteTimer();
    return res.json({ message: 'CTF timer set to infinite mode', timer });
  } catch {
    return res.status(500).json({ error: 'Failed to set timer to infinite mode' });
  }
}
