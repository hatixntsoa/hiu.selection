import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import { Server } from 'socket.io';
import { getDatabase } from '../models/database';
import { ChallengeDifficulty, TeamMemberRow, TeamRow } from '../types';
import { logAction } from '../utils/action-logger';

const MAX_TEAM_MEMBERS = 6;
const ADMIN_SENDER_EMAIL_CONFIG_KEY = 'admin_sender_email';
const ADMIN_SENDER_APP_PASSWORD_CONFIG_KEY = 'admin_sender_app_password';
const ADMIN_OVA_LINK_CONFIG_KEY = 'admin_ova_link';
const ADMIN_PLATFORM_LINK_CONFIG_KEY = 'admin_platform_link';
const ADMIN_CREDENTIALS_TEMPLATE_CONFIG_KEY = 'admin_credentials_template';
const ADMIN_EMAIL_SUBJECT_CONFIG_KEY = 'admin_email_subject';
const DEFAULT_ADMIN_OVA_LINK = 'https://drive.google.com';
const DEFAULT_ADMIN_PLATFORM_LINK = 'https://ctf.link';
const DEFAULT_ADMIN_EMAIL_SUBJECT = 'HIU Selection ENI 2026 - CTF Platform Instructions';
const DEFAULT_CREDENTIALS_TEMPLATE = `Greetings Team <current_team_name_here>,

Welcome to the HIU Selection CTF 2026.

Please find below the necessary information to get started.

- Download the virtual machine (.ova file) for the challenge using the link below:
<google_drive_ova_file_link_here>

- CTF Platform link:
<ctf_platform_link_here>

To submit flags, log in using the following credentials:

- username : <current_team_name_here>
- password : <current_team_password>


We encourage you to explore, collaborate, and make the most of this experience. 
Best of luck, and enjoy the challenge.

Kind regards,
C3LF`;

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

function syncTeamMemberCount(db: sqlite3.Database, teamId: number, callback: (err: Error | null) => void): void {
  db.run(
    `UPDATE teams
     SET member_count = (
       SELECT COUNT(*)
       FROM team_members tm
       WHERE tm.team_id = teams.id AND tm.is_primary = 0
     )
     WHERE id = ?`,
    [teamId],
    (err) => callback(err)
  );
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

function dbGet<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get<T>(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function dbRun(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<sqlite3.RunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function dbAll<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all<T>(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function normalizeLeaderEmail(teamName: string): string {
  return `${teamName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_leader@example.com`;
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function fillTemplate(template: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce((current, [key, value]) => current.split(key).join(value), template);
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
  if (trimmedName.toLowerCase() === 'admin') {
    return res.status(400).json({ error: 'Username is reserved' });
  }
  const syntheticEmail = toSyntheticEmail(trimmedName);
  const leaderEmail = normalizeLeaderEmail(trimmedName);

  db.get<TeamRow>('SELECT * FROM teams WHERE name = ? COLLATE NOCASE', [trimmedName], (lookupErr, existingTeam) => {
    if (lookupErr) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingTeam) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(
      'INSERT INTO teams (name, email, password, team_plain_password, team_leader_email, member_count) VALUES (?, ?, ?, ?, ?, 0)',
      [trimmedName, syntheticEmail, hashedPassword, password, leaderEmail],
      function (this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          if (err.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Username already exists' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }

        const teamId = this.lastID;
        db.run('INSERT INTO team_members (team_id, username, is_primary) VALUES (?, ?, 1)', [teamId, trimmedName], (memberErr) => {
          if (memberErr) {
            return res.status(500).json({ error: 'Registration failed' });
          }

          const token = jwt.sign({ id: teamId, name: trimmedName }, process.env.JWT_SECRET as string, getJwtOptions());
          emitRealtimeUpdates(req);
          logAction('auth.register', `team=${trimmedName} id=${teamId}`);

          return res.status(201).json({
            message: 'Registration successful',
            token,
            team: {
              id: teamId,
              name: trimmedName,
              score: 0,
              isAdmin: false,
              memberCount: 0
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
      logAction('auth.login', `team=${team.name} id=${team.id}`);
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

            db.run(
              'UPDATE team_members SET username = ? WHERE team_id = ? AND is_primary = 1',
              [trimmedName, userId],
              (primaryErr) => {
                if (primaryErr) {
                  return res.status(500).json({ error: 'Database error' });
                }

            syncTeamMemberCount(db, userId, (syncErr) => {
                  if (syncErr) {
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
    'SELECT id, team_id, username, is_primary, created_at FROM team_members WHERE team_id = ? ORDER BY is_primary DESC, created_at ASC, id ASC',
    [userId],
    (err, members) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      const memberCount = members.filter((member) => member.is_primary !== 1).length;
      return res.json({ members, memberCount, maxMembers: MAX_TEAM_MEMBERS });
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

  db.get<{ total: number }>(
    'SELECT COUNT(*) as total FROM team_members WHERE team_id = ? AND is_primary = 0',
    [userId],
    (countErr, countRow) => {
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

        db.run('INSERT INTO team_members (team_id, username, is_primary) VALUES (?, ?, 0)', [userId, trimmedUsername], (insertErr) => {
          if (insertErr) {
            return res.status(500).json({ error: 'Database error' });
          }

          syncTeamMemberCount(db, userId, (syncErr) => {
            if (syncErr) {
              return res.status(500).json({ error: 'Database error' });
            }
            emitRealtimeUpdates(req);
            logAction('team.member.add', `team_id=${userId} username=${trimmedUsername}`);
            return res.status(201).json({ message: 'Member added' });
          });
        });
      });
    });
  });
}

export function updateTeamMember(req: Request, res: Response): Response | void {
  const userId = req.user?.id;
  const memberId = Number(req.params.memberId);
  const { username } = req.body as { username?: string };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isInteger(memberId) || memberId <= 0) {
    return res.status(400).json({ error: 'Team not found' });
  }
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const db = getDatabase();
  const trimmedUsername = username.trim();

  db.get<TeamMemberRow>('SELECT * FROM team_members WHERE id = ? AND team_id = ?', [memberId, userId], (memberLookupErr, member) => {
    if (memberLookupErr) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!member) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (member.is_primary === 1) {
      return res.status(400).json({ error: 'Team name member cannot be edited here' });
    }

    db.get<{ id: number }>('SELECT id FROM teams WHERE name = ? COLLATE NOCASE', [trimmedUsername], (teamNameErr, teamNameClash) => {
      if (teamNameErr) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (teamNameClash) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      db.get<{ id: number }>(
        'SELECT id FROM team_members WHERE username = ? COLLATE NOCASE AND id != ?',
        [trimmedUsername, memberId],
        (memberErr, memberClash) => {
          if (memberErr) {
            return res.status(500).json({ error: 'Database error' });
          }
          if (memberClash) {
            return res.status(400).json({ error: 'Username already exists' });
          }

            db.run('UPDATE team_members SET username = ? WHERE id = ? AND team_id = ?', [trimmedUsername, memberId, userId], (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ error: 'Database error' });
            }
            emitRealtimeUpdates(req);
            logAction('team.member.update', `team_id=${userId} member_id=${memberId} username=${trimmedUsername}`);
            return res.json({ message: 'Member updated' });
          });
        }
      );
    });
  });
}

export function deleteTeamMember(req: Request, res: Response): Response | void {
  const userId = req.user?.id;
  const memberId = Number(req.params.memberId);

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isInteger(memberId) || memberId <= 0) {
    return res.status(400).json({ error: 'Team not found' });
  }

  const db = getDatabase();
  db.get<TeamMemberRow>('SELECT * FROM team_members WHERE id = ? AND team_id = ?', [memberId, userId], (memberLookupErr, member) => {
    if (memberLookupErr) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!member) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (member.is_primary === 1) {
      return res.status(400).json({ error: 'Team name member cannot be deleted' });
    }

    db.run('DELETE FROM team_members WHERE id = ? AND team_id = ?', [memberId, userId], (deleteErr) => {
      if (deleteErr) {
        return res.status(500).json({ error: 'Database error' });
      }

      syncTeamMemberCount(db, userId, (syncErr) => {
        if (syncErr) {
          return res.status(500).json({ error: 'Database error' });
        }
        emitRealtimeUpdates(req);
        logAction('team.member.delete', `team_id=${userId} member_id=${memberId}`);
        return res.json({ message: 'Member deleted' });
      });
    });
  });
}

export function deleteTeamByAdmin(req: Request, res: Response): Response | void {
  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ error: 'Team not found' });
  }

  const db = getDatabase();
  db.get<TeamRow>('SELECT id, name, is_admin FROM teams WHERE id = ?', [teamId], (lookupErr, team) => {
    if (lookupErr) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (team.is_admin === 1) {
      return res.status(400).json({ error: 'Admin team cannot be deleted' });
    }

    db.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
      if (beginErr) {
        return res.status(500).json({ error: 'Database error' });
      }

      db.run('DELETE FROM submissions WHERE team_id = ?', [teamId], (deleteSubmissionsErr) => {
        if (deleteSubmissionsErr) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Database error' });
        }

        db.run('DELETE FROM team_members WHERE team_id = ?', [teamId], (deleteMembersErr) => {
          if (deleteMembersErr) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Database error' });
          }

          db.run('DELETE FROM teams WHERE id = ?', [teamId], (deleteTeamErr) => {
            if (deleteTeamErr) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Database error' });
            }

            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Database error' });
              }

              const io = req.app.get('io') as Server | undefined;
              io?.to(`team:${teamId}`).emit('team_deleted', { teamId });
              emitRealtimeUpdates(req);
              logAction('admin.team.delete', `team=${team.name} id=${teamId}`);
              return res.json({ message: 'Team deleted' });
            });
          });
        });
      });
    });
  });
}

export async function getTeamEditByAdmin(req: Request, res: Response): Promise<Response> {
  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ error: 'Team not found' });
  }

  const db = getDatabase();
  try {
    const team = await dbGet<TeamRow & { team_leader_email: string | null; team_plain_password: string | null }>(
      db,
      `SELECT id, name, email, password, team_leader_email, team_plain_password, score, member_count, is_admin, created_at
       FROM teams
       WHERE id = ?`,
      [teamId]
    );

    if (!team || team.is_admin === 1) {
      return res.status(404).json({ error: 'Team not found' });
    }

    let nextLeaderEmail = team.team_leader_email?.trim() || normalizeLeaderEmail(team.name);
    let nextPlainPassword = team.team_plain_password?.trim() || '';
    if (!nextPlainPassword) {
      const generated = crypto.randomBytes(10).toString('hex');
      const hashed = bcrypt.hashSync(generated, 10);
      await dbRun(db, 'UPDATE teams SET password = ?, team_plain_password = ? WHERE id = ?', [hashed, generated, teamId]);
      nextPlainPassword = generated;
    }
    if (!team.team_leader_email || !team.team_leader_email.trim()) {
      await dbRun(db, 'UPDATE teams SET team_leader_email = ? WHERE id = ?', [nextLeaderEmail, teamId]);
    }

    return res.json({
      team: {
        id: team.id,
        name: team.name,
        score: team.score,
        created_at: team.created_at,
        teamLeaderEmail: nextLeaderEmail
      },
      password: nextPlainPassword
    });
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
}

export async function updateTeamByAdmin(req: Request, res: Response): Promise<Response> {
  const teamId = Number(req.params.teamId);
  const { name, password, teamLeaderEmail } = req.body as { name?: string; password?: string; teamLeaderEmail?: string };

  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ error: 'Team not found' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!teamLeaderEmail || !teamLeaderEmail.trim() || !isLikelyEmail(teamLeaderEmail.trim())) {
    return res.status(400).json({ error: 'Valid team leader email is required' });
  }

  const trimmedLeaderEmail = teamLeaderEmail.trim().toLowerCase();

  const db = getDatabase();
  try {
    const team = await dbGet<TeamRow>(db, 'SELECT * FROM teams WHERE id = ?', [teamId]);
    if (!team || team.is_admin === 1) {
      return res.status(404).json({ error: 'Team not found' });
    }
    const trimmedName = String(name || team.name).trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (trimmedName.toLowerCase() === 'admin') {
      return res.status(400).json({ error: 'Username is reserved' });
    }

    const teamClash = await dbGet<{ id: number }>(db, 'SELECT id FROM teams WHERE id != ? AND name = ? COLLATE NOCASE', [teamId, trimmedName]);
    if (teamClash) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const memberClash = await dbGet<{ id: number }>(
      db,
      `SELECT id
       FROM team_members
       WHERE username = ? COLLATE NOCASE
         AND NOT (team_id = ? AND is_primary = 1)`,
      [trimmedName, teamId]
    );
    if (memberClash) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    await dbRun(
      db,
      'UPDATE teams SET name = ?, email = ?, password = ?, team_plain_password = ?, team_leader_email = ? WHERE id = ?',
      [trimmedName, toSyntheticEmail(trimmedName), hashedPassword, password, trimmedLeaderEmail, teamId]
    );
    if ((team.team_leader_email || '').trim().toLowerCase() !== trimmedLeaderEmail) {
      await dbRun(db, 'UPDATE teams SET creds_shared_email = NULL WHERE id = ?', [teamId]);
    }
    await dbRun(db, 'UPDATE team_members SET username = ? WHERE team_id = ? AND is_primary = 1', [trimmedName, teamId]);
    await new Promise<void>((resolve, reject) => {
      syncTeamMemberCount(db, teamId, (syncErr) => {
        if (syncErr) {
          reject(syncErr);
          return;
        }
        resolve();
      });
    });

    const freshTeam = await dbGet<TeamRow>(db, 'SELECT id, name, email, score, member_count, is_admin, created_at FROM teams WHERE id = ?', [teamId]);
    if (!freshTeam) {
      return res.status(500).json({ error: 'Database error' });
    }

    emitRealtimeUpdates(req);
    logAction('admin.team.update', `team=${trimmedName} id=${teamId}`);
    return res.json({ message: 'Team updated by admin', team: teamPayload(freshTeam) });
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
}

export async function getAdminSenderConfig(_req: Request, res: Response): Promise<Response> {
  const db = getDatabase();
  try {
    const rows = await dbAll<{ key: string; value: string }>(
      db,
      'SELECT key, value FROM app_config WHERE key IN (?, ?, ?, ?, ?, ?)',
      [
        ADMIN_SENDER_EMAIL_CONFIG_KEY,
        ADMIN_SENDER_APP_PASSWORD_CONFIG_KEY,
        ADMIN_OVA_LINK_CONFIG_KEY,
        ADMIN_PLATFORM_LINK_CONFIG_KEY,
        ADMIN_CREDENTIALS_TEMPLATE_CONFIG_KEY,
        ADMIN_EMAIL_SUBJECT_CONFIG_KEY
      ]
    );
    const map = new Map(rows.map((row) => [row.key, row.value]));
    return res.json({
      senderEmail: map.get(ADMIN_SENDER_EMAIL_CONFIG_KEY) || '',
      appPassword: map.get(ADMIN_SENDER_APP_PASSWORD_CONFIG_KEY) || '',
      ovaLink: map.get(ADMIN_OVA_LINK_CONFIG_KEY) || DEFAULT_ADMIN_OVA_LINK,
      platformLink: map.get(ADMIN_PLATFORM_LINK_CONFIG_KEY) || DEFAULT_ADMIN_PLATFORM_LINK,
      credentialsTemplate: map.get(ADMIN_CREDENTIALS_TEMPLATE_CONFIG_KEY) || DEFAULT_CREDENTIALS_TEMPLATE,
      emailSubject: map.get(ADMIN_EMAIL_SUBJECT_CONFIG_KEY) || DEFAULT_ADMIN_EMAIL_SUBJECT
    });
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
}

export async function updateAdminSenderConfig(_req: Request, res: Response): Promise<Response> {
  const { senderEmail, appPassword, ovaLink, platformLink, credentialsTemplate, emailSubject } = _req.body as {
    senderEmail?: string;
    appPassword?: string;
    ovaLink?: string;
    platformLink?: string;
    credentialsTemplate?: string;
    emailSubject?: string;
  };
  if (!senderEmail || !appPassword || !isLikelyEmail(senderEmail.trim())) {
    return res.status(400).json({ error: 'Sender email and app password are required' });
  }
  const normalizedOvaLink = String(ovaLink || '').trim() || DEFAULT_ADMIN_OVA_LINK;
  const normalizedPlatformLink = String(platformLink || '').trim() || DEFAULT_ADMIN_PLATFORM_LINK;
  const normalizedTemplate = String(credentialsTemplate || '').trim() || DEFAULT_CREDENTIALS_TEMPLATE;
  const normalizedEmailSubject = String(emailSubject || '').trim() || DEFAULT_ADMIN_EMAIL_SUBJECT;
  if (!/^https?:\/\//i.test(normalizedOvaLink)) {
    return res.status(400).json({ error: 'Valid OVA link is required' });
  }
  if (!/^https?:\/\//i.test(normalizedPlatformLink)) {
    return res.status(400).json({ error: 'Valid platform link is required' });
  }

  const normalizedEmail = senderEmail.trim().toLowerCase();
  const normalizedPassword = appPassword.trim();
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: normalizedEmail,
        pass: normalizedPassword
      }
    });
    await transporter.verify();
  } catch {
    return res.status(400).json({ error: 'Unable to authenticate sender credentials' });
  }

  const db = getDatabase();
  try {
    await dbRun(
      db,
      `INSERT INTO app_config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [ADMIN_SENDER_EMAIL_CONFIG_KEY, normalizedEmail]
    );
    await dbRun(
      db,
      `INSERT INTO app_config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [ADMIN_SENDER_APP_PASSWORD_CONFIG_KEY, normalizedPassword]
    );
    await dbRun(
      db,
      `INSERT INTO app_config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [ADMIN_OVA_LINK_CONFIG_KEY, normalizedOvaLink]
    );
    await dbRun(
      db,
      `INSERT INTO app_config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [ADMIN_PLATFORM_LINK_CONFIG_KEY, normalizedPlatformLink]
    );
    await dbRun(
      db,
      `INSERT INTO app_config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [ADMIN_CREDENTIALS_TEMPLATE_CONFIG_KEY, normalizedTemplate]
    );
    await dbRun(
      db,
      `INSERT INTO app_config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [ADMIN_EMAIL_SUBJECT_CONFIG_KEY, normalizedEmailSubject]
    );
    logAction('admin.sender.update', `sender=${normalizedEmail}`);
    return res.json({ message: 'Sender credentials updated' });
  } catch {
    return res.status(500).json({ error: 'Database error' });
  }
}

export async function shareTeamCredentialsByAdmin(req: Request, res: Response): Promise<Response> {
  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ error: 'Team not found' });
  }

  const db = getDatabase();
  try {
    const team = await dbGet<TeamRow & { team_leader_email: string | null; team_plain_password: string | null }>(
      db,
      `SELECT id, name, score, is_admin, team_leader_email, team_plain_password
       FROM teams
       WHERE id = ?`,
      [teamId]
    );
    if (!team || team.is_admin === 1) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const leaderEmail = team.team_leader_email?.trim();
    if (!leaderEmail) {
      return res.status(400).json({ error: 'Team credentials are incomplete' });
    }
    const rotatedPassword = crypto.randomBytes(10).toString('hex');
    const rotatedHash = bcrypt.hashSync(rotatedPassword, 10);
    await dbRun(db, 'UPDATE teams SET password = ?, team_plain_password = ? WHERE id = ?', [rotatedHash, rotatedPassword, teamId]);

    const configRows = await dbAll<{ key: string; value: string }>(
      db,
      'SELECT key, value FROM app_config WHERE key IN (?, ?, ?, ?, ?, ?)',
      [
        ADMIN_SENDER_EMAIL_CONFIG_KEY,
        ADMIN_SENDER_APP_PASSWORD_CONFIG_KEY,
        ADMIN_OVA_LINK_CONFIG_KEY,
        ADMIN_PLATFORM_LINK_CONFIG_KEY,
        ADMIN_CREDENTIALS_TEMPLATE_CONFIG_KEY,
        ADMIN_EMAIL_SUBJECT_CONFIG_KEY
      ]
    );
    const configMap = new Map(configRows.map((row) => [row.key, row.value]));
    const senderEmail = configMap.get(ADMIN_SENDER_EMAIL_CONFIG_KEY);
    const senderPassword = configMap.get(ADMIN_SENDER_APP_PASSWORD_CONFIG_KEY);
    const ovaLink = configMap.get(ADMIN_OVA_LINK_CONFIG_KEY) || DEFAULT_ADMIN_OVA_LINK;
    const platformLink = configMap.get(ADMIN_PLATFORM_LINK_CONFIG_KEY) || DEFAULT_ADMIN_PLATFORM_LINK;
    const template = configMap.get(ADMIN_CREDENTIALS_TEMPLATE_CONFIG_KEY) || DEFAULT_CREDENTIALS_TEMPLATE;
    const emailSubject = configMap.get(ADMIN_EMAIL_SUBJECT_CONFIG_KEY) || DEFAULT_ADMIN_EMAIL_SUBJECT;
    if (!senderEmail || !senderPassword) {
      return res.status(400).json({ error: 'Admin sender credentials are not configured' });
    }
    const body = fillTemplate(template, {
      '<current_team_name_here>': team.name,
      '<ctf_platform_link_here>': platformLink,
      '<current_team_password>': rotatedPassword,
      '<google_drive_ova_file_link_here>': ovaLink
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: senderEmail,
        pass: senderPassword
      }
    });

    await transporter.sendMail({
      from: senderEmail,
      to: leaderEmail,
      subject: emailSubject,
      text: body
    });
    await dbRun(db, 'UPDATE teams SET creds_shared_email = ? WHERE id = ?', [leaderEmail.toLowerCase(), teamId]);
    logAction('admin.team.share', `team=${team.name} id=${teamId} leader=${leaderEmail}`);
    return res.json({ message: 'Team credentials email sent' });
  } catch {
    return res.status(500).json({ error: 'Failed to send team credentials email' });
  }
}

type AdminSubmissionRow = {
  id: number;
  submitted_flag: string;
  is_correct: number;
  awarded_points: number;
  submitted_at: string;
  challenge_public_id: string | null;
  challenge_difficulty: ChallengeDifficulty | null;
};

export function getTeamDetailsByAdmin(req: Request, res: Response): Response | void {
  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ error: 'Team not found' });
  }

  const db = getDatabase();
  db.get<TeamRow>(
    'SELECT id, name, score, member_count, created_at, is_admin, team_leader_email FROM teams WHERE id = ?',
    [teamId],
    (teamErr, team) => {
      if (teamErr) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!team || team.is_admin === 1) {
        return res.status(404).json({ error: 'Team not found' });
      }

      db.all<TeamMemberRow>(
        `SELECT id, team_id, username, is_primary, created_at
         FROM team_members
         WHERE team_id = ?
         ORDER BY is_primary DESC, created_at ASC, id ASC`,
        [teamId],
        (membersErr, members) => {
          if (membersErr) {
            return res.status(500).json({ error: 'Database error' });
          }

          db.all<AdminSubmissionRow>(
            `SELECT s.id, s.submitted_flag, s.is_correct, s.awarded_points, s.submitted_at, c.public_id as challenge_public_id, c.difficulty as challenge_difficulty
             FROM submissions s
             LEFT JOIN challenges c ON c.id = s.challenge_id
             WHERE s.team_id = ?
             ORDER BY s.submitted_at DESC, s.id DESC`,
            [teamId],
            (submissionsErr, submissions) => {
              if (submissionsErr) {
                return res.status(500).json({ error: 'Database error' });
              }

              return res.json({
                team: {
                  id: team.id,
                  name: team.name,
                  score: team.score,
                  memberCount: team.member_count || 0,
                  created_at: team.created_at,
                  teamLeaderEmail: team.team_leader_email || null
                },
                members,
                submissions
              });
            }
          );
        }
      );
    }
  );
}
