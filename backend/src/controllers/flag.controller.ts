import { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import { Server } from 'socket.io';
import { getDatabase } from '../models/database';
import { getCtfTimerState } from '../models/timer';
import { ChallengeRow } from '../types';

type SubmissionRow = {
  id: number;
  challenge_id: number;
  challenge_public_id: string;
  submitted_flag: string;
  awarded_points: number;
  is_correct: number;
  submitted_at: string;
  challenge_title: string;
};

type FlagSubmissionBody = {
  flag?: string;
};

type SolveCountRow = {
  total: number;
};

export async function submitFlag(req: Request, res: Response, io?: Server): Promise<Response | void> {
  const { flag } = req.body as FlagSubmissionBody;
  const teamId = req.user?.id;

  if (!teamId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!flag) {
    return res.status(400).json({ error: 'Flag value is required' });
  }

  try {
    const timer = await getCtfTimerState();
    if (!timer.canSubmit) {
      return res.status(403).json({ error: 'Flag submissions are currently closed.' });
    }
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }

  const db = getDatabase();

  db.get<ChallengeRow>('SELECT * FROM challenges WHERE LOWER(TRIM(flag)) = LOWER(TRIM(?))', [flag], (challengeErr, challenge) => {
    if (challengeErr) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!challenge) {
      res.json({
        correct: false,
        message: 'Incorrect flag. Try again!',
        points: 0
      });
      return;
    }

    db.get(
      'SELECT id FROM submissions WHERE team_id = ? AND challenge_id = ? AND is_correct = 1',
      [teamId, challenge.id],
      (existingErr, existing) => {
        if (existingErr) {
          return res.status(500).json({ error: 'Database error' });
        }
        if (existing) {
          return res.status(400).json({ error: 'You have already solved this challenge' });
        }

        db.get<SolveCountRow>(
          'SELECT COUNT(*) as total FROM submissions WHERE challenge_id = ? AND is_correct = 1',
          [challenge.id],
          (countErr, countRow) => {
            if (countErr) {
              return res.status(500).json({ error: 'Database error' });
            }
            const solveCount = countRow?.total || 0;
            const awardedPoints =
              solveCount === 0
                ? Number(challenge.first_blood_points) || 100
                : solveCount === 1
                  ? Number(challenge.second_blood_points) || 75
                  : Number(challenge.default_points) || 50;

            db.run(
              'INSERT INTO submissions (team_id, challenge_id, submitted_flag, is_correct, awarded_points) VALUES (?, ?, ?, 1, ?)',
              [teamId, challenge.id, flag, awardedPoints],
              function (this: sqlite3.RunResult, submissionErr: Error | null) {
                if (submissionErr) {
                  return res.status(500).json({ error: 'Failed to submit flag' });
                }

                db.run('UPDATE teams SET score = score + ? WHERE id = ?', [awardedPoints, teamId]);
                db.get<{ name: string }>('SELECT name FROM teams WHERE id = ?', [teamId], (_teamErr, team) => {
                  const activity = {
                    teamName: team?.name || 'Unknown',
                    points: awardedPoints,
                    timestamp: new Date().toISOString()
                  };
                  io?.emit('flag_captured', activity);
                  io?.emit('scoreboard_update');
                });

                res.json({
                  correct: true,
                  message: 'Correct! Flag accepted.',
                  points: awardedPoints
                });
              }
            );
          }
        );
      }
    );
  });
}

export function getSubmissionHistory(req: Request, res: Response): Response | void {
  const teamId = req.user?.id;

  if (!teamId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const db = getDatabase();

  db.all<SubmissionRow>(
    `SELECT s.id, s.challenge_id, c.public_id as challenge_public_id, s.submitted_flag, s.is_correct, s.awarded_points, s.submitted_at, c.title as challenge_title
     FROM submissions s
     LEFT JOIN challenges c ON s.challenge_id = c.id
     WHERE s.team_id = ?
     ORDER BY s.submitted_at DESC`,
    [teamId],
    (err, submissions) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ submissions });
    }
  );
}
