import { Request, Response } from 'express';
import { getDatabase } from '../models/database';

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
