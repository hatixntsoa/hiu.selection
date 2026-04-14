import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import { Server } from 'socket.io';
import { getDatabase } from '../models/database';
import { TeamMemberRow, TeamRow } from '../types';

const MAX_TEAM_MEMBERS = 6;

function getJwtOptions(): SignOptions {
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return { expiresIn: expiresIn as SignOptions['expiresIn'] };
}

function toSyntheticEmail(teamName: string): string {
  return `${teamName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}@ctf.local`;
}

function emitRealtimeUpdates(req: Request): void {
  const io = req.app.get('io') as Server | undefined;
  io?.emit('scoreboard_update');
}

function teamPayload(team: TeamRow): { id: number; name: string; score: number; isAdmin: boolean; memberCount: number } {
  return {
    id: team.id,
    name: team.name,
    score: team.score,
    isAdmin: team.is_admin === 1,
    memberCount: team.member_count || 0
  };
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
  const syntheticEmail = toSyntheticEmail(trimmedName);

  db.get<TeamRow>('SELECT * FROM teams WHERE name = ? COLLATE NOCASE', [trimmedName], (lookupErr, existingTeam) => {
    if (lookupErr) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingTeam) {
      return res.status(400).json({ error: 'Username already exists' });
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

        const teamId = this.lastID;
        db.run('INSERT INTO team_members (team_id, username) VALUES (?, ?)', [teamId, trimmedName], (memberErr) => {
          if (memberErr) {
            return res.status(500).json({ error: 'Registration failed' });
          }

          const token = jwt.sign({ id: teamId, name: trimmedName }, process.env.JWT_SECRET as string, getJwtOptions());
          emitRealtimeUpdates(req);

          return res.status(201).json({
            message: 'Registration successful',
            token,
            team: {
              id: teamId,
              name: trimmedName,
              score: 0,
              isAdmin: false,
              memberCount: 1
            }
          });
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
  const trimmedName = name.trim();

  db.get<TeamRow>(
    `SELECT t.*
     FROM teams t
     LEFT JOIN team_members tm ON tm.team_id = t.id
     WHERE t.name = ? COLLATE NOCASE OR tm.username = ? COLLATE NOCASE
     ORDER BY CASE WHEN t.name = ? COLLATE NOCASE THEN 0 ELSE 1 END
     LIMIT 1`,
    [trimmedName, trimmedName, trimmedName],
    (err, team) => {
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

      const token = jwt.sign({ id: team.id, name: team.name }, process.env.JWT_SECRET as string, getJwtOptions());
      return res.json({
        message: 'Login successful',
        token,
        team: teamPayload(team)
      });
    }
  );
}

export function getMe(req: Request, res: Response): Response | void {
  const db = getDatabase();
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  db.get<TeamRow>(
    'SELECT id, name, email, score, member_count, is_admin, created_at FROM teams WHERE id = ?',
    [userId],
    (err, team) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      return res.json({ team: teamPayload(team) });
    }
  );
}

export function updateTeam(req: Request, res: Response): Response | void {
  const userId = req.user?.id;
  const { name } = req.body as { name?: string };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const db = getDatabase();
  const trimmedName = name.trim();
  const syntheticEmail = toSyntheticEmail(trimmedName);

  db.get<TeamRow>('SELECT * FROM teams WHERE id = ?', [userId], (teamErr, currentTeam) => {
    if (teamErr) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!currentTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }

    db.get<{ id: number }>('SELECT id FROM teams WHERE id != ? AND name = ? COLLATE NOCASE', [userId, trimmedName], (nameErr, clashTeam) => {
      if (nameErr) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (clashTeam) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      db.get<{ id: number }>(
        'SELECT id FROM team_members WHERE team_id != ? AND username = ? COLLATE NOCASE',
        [userId, trimmedName],
        (memberErr, clashMember) => {
          if (memberErr) {
            return res.status(500).json({ error: 'Database error' });
          }
          if (clashMember) {
            return res.status(400).json({ error: 'Username already exists' });
          }

          db.run('UPDATE teams SET name = ?, email = ? WHERE id = ?', [trimmedName, syntheticEmail, userId], (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ error: 'Database error' });
            }

            db.get<TeamRow>(
              'SELECT id, name, email, score, member_count, is_admin, created_at FROM teams WHERE id = ?',
              [userId],
              (freshErr, freshTeam) => {
                if (freshErr || !freshTeam) {
                  return res.status(500).json({ error: 'Database error' });
                }
                emitRealtimeUpdates(req);
                return res.json({ message: 'Team updated', team: teamPayload(freshTeam) });
              }
            );
          });
        }
      );
    });
  });
}

export function listTeamMembers(req: Request, res: Response): Response | void {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const db = getDatabase();
  db.all<TeamMemberRow>(
    'SELECT id, team_id, username, created_at FROM team_members WHERE team_id = ? ORDER BY created_at ASC, id ASC',
    [userId],
    (err, members) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      return res.json({ members, memberCount: members.length, maxMembers: MAX_TEAM_MEMBERS });
    }
  );
}

export function addTeamMember(req: Request, res: Response): Response | void {
  const userId = req.user?.id;
  const { username } = req.body as { username?: string };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const db = getDatabase();
  const trimmedUsername = username.trim();

  db.get<{ total: number }>('SELECT COUNT(*) as total FROM team_members WHERE team_id = ?', [userId], (countErr, countRow) => {
    if (countErr) {
      return res.status(500).json({ error: 'Database error' });
    }
    if ((countRow?.total || 0) >= MAX_TEAM_MEMBERS) {
      return res.status(400).json({ error: 'Team has reached the maximum of 6 members' });
    }

    db.get<{ id: number }>('SELECT id FROM teams WHERE name = ? COLLATE NOCASE', [trimmedUsername], (teamNameErr, teamNameClash) => {
      if (teamNameErr) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (teamNameClash) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      db.get<{ id: number }>('SELECT id FROM team_members WHERE username = ? COLLATE NOCASE', [trimmedUsername], (memberErr, memberClash) => {
        if (memberErr) {
          return res.status(500).json({ error: 'Database error' });
        }
        if (memberClash) {
          return res.status(400).json({ error: 'Username already exists' });
        }

        db.run('INSERT INTO team_members (team_id, username) VALUES (?, ?)', [userId, trimmedUsername], (insertErr) => {
          if (insertErr) {
            return res.status(500).json({ error: 'Database error' });
          }

          db.run(
            `UPDATE teams
             SET member_count = (SELECT COUNT(*) FROM team_members WHERE team_id = ?)
             WHERE id = ?`,
            [userId, userId],
            (syncErr) => {
              if (syncErr) {
                return res.status(500).json({ error: 'Database error' });
              }
              emitRealtimeUpdates(req);
              return res.status(201).json({ message: 'Member added' });
            }
          );
        });
      });
    });
  });
}
