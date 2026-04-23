import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import { getDatabase } from '../models/database';
import { getDatabasePath } from '../models/database';
import {
  addTimerSeconds,
  getCtfTimerState,
  restartFiniteTimer,
  startFiniteTimer,
  setFiniteDuration,
  setInfiniteTimer
} from '../models/timer';
import { logAction } from '../utils/action-logger';

type ScoreboardTeam = {
  id: number;
  name: string;
  score: number;
  created_at: string;
  last_solve_at?: string | null;
  team_leader_email?: string | null;
  creds_shared_email?: string | null;
  rank?: number | null;
};

type ActivityRow = {
  submitted_at: string;
  team_name: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  challenge_type: 'challenge' | 'vm' | null;
};

type CountRow = { total: number };
type HighestScoreRow = { highest_score: number | null };
type ExportScoreboardRow = { rank: number | null; name: string; score: number; scoreOverThirty: string };
type ExportChallengeRow = { difficulty: 'easy' | 'medium' | 'hard' | null; first_blood_points: number | null };

async function buildScoreboardPdfBuffer(rows: ExportScoreboardRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const marginX = 40;
    const pageTop = 40;
    const pageBottom = 800;
    const tableTop = 60;
    const headerHeight = 26;
    const rowHeight = 24;
    const rankWidth = 70;
    const teamWidth = 280;
    const rawWidth = 85;
    const scoreThirtyWidth = 80;
    const tableWidth = rankWidth + teamWidth + rawWidth + scoreThirtyWidth;
    const colX = {
      rank: marginX,
      team: marginX + rankWidth,
      raw: marginX + rankWidth + teamWidth,
      scoreThirty: marginX + rankWidth + teamWidth + rawWidth
    };

    const drawHeader = (y: number): number => {
      doc.font('Helvetica-Bold').fontSize(11);
      doc.fillColor('#34495E').rect(marginX, y, tableWidth, headerHeight).fill();
      doc.fillColor('#FFFFFF');
      doc.text('Rank', colX.rank + 6, y + 8, { width: rankWidth - 12, align: 'left' });
      doc.text('Team Name', colX.team + 6, y + 8, { width: teamWidth - 12, align: 'left' });
      doc.text('Raw Points', colX.raw + 6, y + 8, { width: rawWidth - 12, align: 'left' });
      doc.text('Score /30', colX.scoreThirty + 6, y + 8, { width: scoreThirtyWidth - 12, align: 'left' });
      doc.fillColor('#111111');
      return y + headerHeight;
    };

    const drawRow = (y: number, row: ExportScoreboardRow): number => {
      const rank = row.rank ? String(row.rank) : '-';
      doc.rect(marginX, y, tableWidth, rowHeight).strokeColor('#DADADA').lineWidth(1).stroke();
      doc.font('Helvetica').fontSize(11).fillColor('#111111');
      doc.text(rank, colX.rank + 6, y + 7, { width: rankWidth - 12, align: 'left' });
      doc.text(row.name, colX.team + 6, y + 7, { width: teamWidth - 12, align: 'left', ellipsis: true });
      doc.text(String(row.score), colX.raw + 6, y + 7, { width: rawWidth - 12, align: 'left' });
      doc.text(row.scoreOverThirty, colX.scoreThirty + 6, y + 7, { width: scoreThirtyWidth - 12, align: 'left' });
      return y + rowHeight;
    };

    doc.fontSize(16).fillColor('#111111').text('Selection HIU 2026 - CTF', marginX, pageTop);
    let y = drawHeader(tableTop);

    rows.forEach((row) => {
      if (y + rowHeight > pageBottom) {
        doc.addPage();
        y = drawHeader(pageTop);
      }
      y = drawRow(y, row);
    });

    doc.end();
  });
}

export function getScoreboard(_req: Request, res: Response): Response | void {
  const db = getDatabase();

  db.all<ScoreboardTeam>(
    `SELECT t.id, t.name, t.score, t.created_at
            , t.team_leader_email
            , t.creds_shared_email
            , solves.last_solve_at
     FROM teams t
     LEFT JOIN (
       SELECT team_id, MAX(submitted_at) AS last_solve_at
       FROM submissions
       WHERE is_correct = 1
       GROUP BY team_id
     ) solves ON solves.team_id = t.id
     WHERE is_admin = 0
     ORDER BY
       CASE WHEN t.score > 0 THEN 0 ELSE 1 END ASC,
       t.score DESC,
       CASE WHEN solves.last_solve_at IS NULL THEN 1 ELSE 0 END ASC,
       solves.last_solve_at ASC,
       t.created_at ASC,
       LOWER(t.name) ASC`,
    [],
    (err, teams) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      let rankedCounter = 0;
      const scoreboard = teams.map((team) => {
        if (team.score > 0) {
          rankedCounter += 1;
          return { ...team, rank: rankedCounter };
        }
        return { ...team, rank: null };
      });

      res.json({ scoreboard });
    }
  );
}

export function getActivityFeed(_req: Request, res: Response): Response | void {
  const db = getDatabase();

  db.all<ActivityRow>(
    `SELECT s.submitted_at, t.name as team_name, s.awarded_points as points, c.difficulty as difficulty, c.challenge_type as challenge_type
     FROM submissions s
     JOIN teams t ON s.team_id = t.id
     LEFT JOIN challenges c ON s.challenge_id = c.id
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

    db.get<CountRow>('SELECT COUNT(*) as total FROM challenges', [], (_err2, flagsRow) => {
      stats.totalChallenges = flagsRow?.total || 0;

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

export async function startTimer(req: Request, res: Response): Promise<Response> {
  const { durationSeconds } = req.body as TimerRequestBody;
  if (typeof durationSeconds !== 'undefined' && (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds))) {
    return res.status(400).json({ error: 'Duration must be a valid number of seconds' });
  }

  try {
    const timer = await startFiniteTimer(durationSeconds);
    return res.json({ message: 'CTF timer started', timer });
  } catch {
    return res.status(500).json({ error: 'Failed to start timer' });
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

export function exportDataBundle(_req: Request, res: Response): Response | void {
  const db = getDatabase();
  db.all<ExportScoreboardRow>(
    `SELECT t.name, t.score
     FROM teams t
     LEFT JOIN (
       SELECT team_id, MAX(submitted_at) AS last_solve_at
       FROM submissions
       WHERE is_correct = 1
       GROUP BY team_id
     ) solves ON solves.team_id = t.id
     WHERE is_admin = 0
     ORDER BY
       CASE WHEN t.score > 0 THEN 0 ELSE 1 END ASC,
       t.score DESC,
       CASE WHEN solves.last_solve_at IS NULL THEN 1 ELSE 0 END ASC,
       solves.last_solve_at ASC,
       t.created_at ASC,
       LOWER(t.name) ASC`,
    [],
    async (err, teams) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      db.all<ExportChallengeRow>('SELECT difficulty, first_blood_points FROM challenges', [], async (challengeErr, challenges) => {
        if (challengeErr) {
          return res.status(500).json({ error: 'Database error' });
        }

        const challengeMaxPoints = challenges.reduce((sum, challenge) => {
          const explicit = Number(challenge.first_blood_points || 0);
          if (explicit > 0) {
            return sum + explicit;
          }
          if (challenge.difficulty === 'hard') {
            return sum + 300;
          }
          if (challenge.difficulty === 'medium') {
            return sum + 200;
          }
          return sum + 100;
        }, 0);

        const pointsPerThirty = challengeMaxPoints > 0 ? challengeMaxPoints / 30 : 0;
        const rankedRows = teams.map((team, index) => ({ ...team, rank: team.score > 0 ? index + 1 : null }));
        const rows = rankedRows.map((team) => {
          const normalized = pointsPerThirty > 0 ? team.score / pointsPerThirty : 0;
          const scoreOverThirty = Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2);
          return { ...team, scoreOverThirty };
        });
        const now = new Date();
        const generatedAt = now.toISOString();
        const stamp = generatedAt.replace(/[:.]/g, '-');
        const pdfName = `hiu-selection-result-${stamp}.pdf`;
        const zipName = `hiu-selection-data-exported-${stamp}.zip`;

        try {
          const pdfBuffer = await buildScoreboardPdfBuffer(rows);
          const dbPath = getDatabasePath();
          const logPath = path.join(path.dirname(dbPath), 'ctf.log');

          if (!fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, '');
          }

          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

          const archive = archiver('zip', { zlib: { level: 9 } });
          archive.on('error', () => {
            if (!res.headersSent) {
              res.status(500).json({ error: 'Failed to export data' });
            }
          });
          archive.pipe(res);
          archive.append(pdfBuffer, { name: pdfName });
          archive.file(dbPath, { name: 'ctf.db' });
          archive.file(logPath, { name: 'ctf.log' });
          void archive.finalize();
          logAction('admin.data.export', `zip=${zipName}`);
        } catch {
          return res.status(500).json({ error: 'Failed to export data' });
        }
      });
    }
  );
}
