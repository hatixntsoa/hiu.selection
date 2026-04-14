import { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import { Server } from 'socket.io';
import { getDatabase } from '../models/database';
import { ChallengeRow } from '../types';

type SubmissionRow = {
  id: number;
  challenge_id: number;
  submitted_flag: string;
  is_correct: number;
  submitted_at: string;
  challenge_title: string;
  points: number;
};

type FlagSubmissionBody = {
  challengeId?: number;
  flag?: string;
};

export function submitFlag(req: Request, res: Response, io?: Server): Response | void {
  const { challengeId, flag } = req.body as FlagSubmissionBody;
  const teamId = req.user?.id;

  if (!teamId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!challengeId || !flag) {
    return res.status(400).json({ error: 'Challenge ID and flag are required' });
  }

  const db = getDatabase();

  db.get(
    'SELECT * FROM submissions WHERE team_id = ? AND challenge_id = ? AND is_correct = 1',
    [teamId, challengeId],
    (err, existing) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (existing) {
        return res.status(400).json({ error: 'You have already solved this challenge' });
      }

      db.get<ChallengeRow>('SELECT * FROM challenges WHERE id = ?', [challengeId], (challengeErr, challenge) => {
        if (challengeErr) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!challenge) {
          return res.status(404).json({ error: 'Challenge not found' });
        }

        const isCorrect = flag.trim().toLowerCase() === challenge.flag.trim().toLowerCase();

        db.run(
          'INSERT INTO submissions (team_id, challenge_id, submitted_flag, is_correct) VALUES (?, ?, ?, ?)',
          [teamId, challengeId, flag, isCorrect ? 1 : 0],
          function (this: sqlite3.RunResult, submissionErr: Error | null) {
            if (submissionErr) {
              return res.status(500).json({ error: 'Failed to submit flag' });
            }

            if (isCorrect) {
              db.run('UPDATE teams SET score = score + ? WHERE id = ?', [challenge.points, teamId]);

              db.get<{ name: string }>('SELECT name FROM teams WHERE id = ?', [teamId], (_teamErr, team) => {
                const activity = {
                  teamName: team?.name || 'Unknown',
                  challengeTitle: challenge.title,
                  points: challenge.points,
                  timestamp: new Date().toISOString()
                };

                io?.emit('flag_captured', activity);
                io?.emit('scoreboard_update');
              });
            }

            res.json({
              correct: isCorrect,
              message: isCorrect ? 'Correct! Flag accepted.' : 'Incorrect flag. Try again!',
              points: isCorrect ? challenge.points : 0
            });
          }
        );
      });
    }
  );
}

export function getSubmissionHistory(req: Request, res: Response): Response | void {
  const teamId = req.user?.id;

  if (!teamId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const db = getDatabase();

  db.all<SubmissionRow>(
    `SELECT s.id, s.challenge_id, s.submitted_flag, s.is_correct, s.submitted_at, c.title as challenge_title, c.points
     FROM submissions s
     JOIN challenges c ON s.challenge_id = c.id
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
