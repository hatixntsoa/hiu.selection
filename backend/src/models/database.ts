import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import fs from 'fs';

const sqlite = sqlite3.verbose();
const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(__dirname, '../../data/ctf.db');
const ADMIN_USERNAME = 'admin';
const ADMIN_EMAIL = 'admin@ctf.local';
const ADMIN_PASSWORD_CONFIG_KEY = 'admin_plain_password';
const ADMIN_PASSWORD_LENGTH = 16;
const DEFAULT_FIRST_BLOOD_POINTS = 100;
const DEFAULT_SECOND_BLOOD_POINTS = 75;
const DEFAULT_OTHER_POINTS = 50;

let db: sqlite3.Database | null = null;

function generateSecurePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < ADMIN_PASSWORD_LENGTH; i += 1) {
    password += alphabet[crypto.randomInt(alphabet.length)];
  }
  return password;
}

export function getDatabase(): sqlite3.Database {
  if (!db) {
    const dbDirectory = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDirectory)) {
      fs.mkdirSync(dbDirectory, { recursive: true });
    }

    db = new sqlite.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        db = null;
      } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
      }
    });
  }
  return db;
}

export function getDatabasePath(): string {
  return DB_PATH;
}

function initializeDatabase(): void {
  if (!db) {
    return;
  }

  db.serialize(() => {
    db!.run(`
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        member_count INTEGER DEFAULT 1,
        is_admin BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db!.all<{ name: string }>('PRAGMA table_info(teams)', [], (pragmaErr, columns) => {
      if (pragmaErr) {
        console.error('Error checking teams schema:', pragmaErr);
        return;
      }
      const hasMemberCount = columns.some((column) => column.name === 'member_count');
      if (!hasMemberCount) {
        db!.run('ALTER TABLE teams ADD COLUMN member_count INTEGER DEFAULT 1');
      }
    });

    db!.run(`
      CREATE TABLE IF NOT EXISTS team_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        username TEXT UNIQUE COLLATE NOCASE NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id)
      )
    `);

    db!.run('ALTER TABLE team_members ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0', (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column name')) {
        console.error('Error ensuring team_members.is_primary:', alterErr);
      }
    });

    db!.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE COLLATE NOCASE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db!.run(`
      CREATE TABLE IF NOT EXISTS challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_id TEXT UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        first_blood_points INTEGER NOT NULL DEFAULT 100,
        second_blood_points INTEGER NOT NULL DEFAULT 75,
        default_points INTEGER NOT NULL DEFAULT 50,
        flag TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const sampleChallenges: Array<[string, string, string]> = [
      ['Welcome', 'Find the flag in the welcome message!', 'HIU_2026{welcome_to_ctf}'],
      ['Basic Crypto', 'Decrypt this Caesar cipher: syne{pnrfne_rpelcgb}', 'HIU_2026{caesar_encryption}'],
      ['Web Basics', 'Inspect the page source to find the hidden flag', 'HIU_2026{view_source_master}'],
      ['Binary Explorer', 'Analyze the binary and extract the flag', 'HIU_2026{binary_explorer_solved}'],
      ['Database Dive', 'Query the database to uncover the secret', 'HIU_2026{sql_master_2024}']
    ];

    const defaultCategories = ['Web', 'Crypto', 'Reverse', 'Misc', 'SQL', 'Forensics'];

    db!.all<{ name: string }>('PRAGMA table_info(challenges)', [], (challengePragmaErr, challengeColumns) => {
      if (challengePragmaErr) {
        console.error('Error checking challenges schema:', challengePragmaErr);
        return;
      }
      type MigrationStep = {
        sql: string;
        params?: unknown[];
        errorLabel: string;
      };
      const migrationSteps: MigrationStep[] = [];

      const hasPublicId = challengeColumns.some((column) => column.name === 'public_id');
      if (!hasPublicId) {
        migrationSteps.push({
          sql: 'ALTER TABLE challenges ADD COLUMN public_id TEXT',
          errorLabel: 'Error adding challenges.public_id'
        });
      }
      const hasFirstBloodPoints = challengeColumns.some((column) => column.name === 'first_blood_points');
      if (!hasFirstBloodPoints) {
        migrationSteps.push({
          sql: 'ALTER TABLE challenges ADD COLUMN first_blood_points INTEGER NOT NULL DEFAULT 100',
          errorLabel: 'Error adding challenges.first_blood_points'
        });
      }
      const hasSecondBloodPoints = challengeColumns.some((column) => column.name === 'second_blood_points');
      if (!hasSecondBloodPoints) {
        migrationSteps.push({
          sql: 'ALTER TABLE challenges ADD COLUMN second_blood_points INTEGER NOT NULL DEFAULT 75',
          errorLabel: 'Error adding challenges.second_blood_points'
        });
      }
      const hasDefaultPoints = challengeColumns.some((column) => column.name === 'default_points');
      if (!hasDefaultPoints) {
        migrationSteps.push({
          sql: 'ALTER TABLE challenges ADD COLUMN default_points INTEGER NOT NULL DEFAULT 50',
          errorLabel: 'Error adding challenges.default_points'
        });
      }
      migrationSteps.push({
        sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_public_id ON challenges(public_id)',
        errorLabel: 'Error creating challenges public_id index'
      });

      defaultCategories.forEach((category) => {
        migrationSteps.push({
          sql: 'INSERT OR IGNORE INTO categories (name) VALUES (?)',
          params: [category],
          errorLabel: 'Error seeding categories'
        });
      });

      sampleChallenges.forEach(([title, desc, flag]) => {
        migrationSteps.push({
          sql: `INSERT OR IGNORE INTO challenges (
                  public_id, title, description, flag, first_blood_points, second_blood_points, default_points
                ) VALUES (lower(hex(randomblob(3))), ?, ?, ?, ?, ?, ?)`,
          params: [title, desc, flag, DEFAULT_FIRST_BLOOD_POINTS, DEFAULT_SECOND_BLOOD_POINTS, DEFAULT_OTHER_POINTS],
          errorLabel: 'Error seeding sample flags'
        });
      });

      migrationSteps.push({
        sql: `UPDATE challenges
              SET public_id = lower(hex(randomblob(3)))
              WHERE public_id IS NULL OR LENGTH(TRIM(public_id)) != 6`,
        errorLabel: 'Error normalizing challenges.public_id'
      });
      migrationSteps.push({
        sql: `UPDATE challenges
              SET first_blood_points = ${DEFAULT_FIRST_BLOOD_POINTS}
              WHERE first_blood_points IS NULL OR first_blood_points <= 0`,
        errorLabel: 'Error normalizing challenges.first_blood_points'
      });
      migrationSteps.push({
        sql: `UPDATE challenges
              SET second_blood_points = ${DEFAULT_SECOND_BLOOD_POINTS}
              WHERE second_blood_points IS NULL OR second_blood_points <= 0`,
        errorLabel: 'Error normalizing challenges.second_blood_points'
      });
      migrationSteps.push({
        sql: `UPDATE challenges
              SET default_points = ${DEFAULT_OTHER_POINTS}
              WHERE default_points IS NULL OR default_points <= 0`,
        errorLabel: 'Error normalizing challenges.default_points'
      });

      migrationSteps.push({
        sql: `UPDATE challenges
              SET flag = REPLACE(REPLACE(flag, 'FLAG{', 'HIU_2026{'), 'flag{', 'HIU_2026{')
              WHERE flag LIKE '%flag{%' COLLATE NOCASE`,
        errorLabel: 'Error normalizing challenge flags'
      });
      migrationSteps.push({
        sql: `UPDATE challenges
              SET description = REPLACE(REPLACE(description, 'FLAG{', 'HIU_2026{'), 'flag{', 'HIU_2026{')
              WHERE description LIKE '%flag{%' COLLATE NOCASE`,
        errorLabel: 'Error normalizing challenge descriptions'
      });

      const runChallengeMigration = (index: number): void => {
        if (index >= migrationSteps.length) {
        console.log('Database initialization complete');
          return;
        }
        const step = migrationSteps[index];
        db!.run(step.sql, step.params ?? [], (stepErr) => {
          if (stepErr) {
            console.error(step.errorLabel, stepErr);
            return;
          }
          runChallengeMigration(index + 1);
        });
      };
      runChallengeMigration(0);
    });

    db!.run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        challenge_id INTEGER NOT NULL,
        awarded_points INTEGER NOT NULL DEFAULT 0,
        submitted_flag TEXT,
        is_correct BOOLEAN,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id),
        FOREIGN KEY (challenge_id) REFERENCES challenges(id)
      )
    `);

    db!.all<{ name: string }>('PRAGMA table_info(submissions)', [], (submissionPragmaErr, submissionColumns) => {
      if (submissionPragmaErr) {
        console.error('Error checking submissions schema:', submissionPragmaErr);
        return;
      }
      const hasAwardedPoints = submissionColumns.some((column) => column.name === 'awarded_points');
      if (!hasAwardedPoints) {
        db!.run('ALTER TABLE submissions ADD COLUMN awarded_points INTEGER NOT NULL DEFAULT 0', (alterErr) => {
          if (alterErr) {
            console.error('Error adding submissions.awarded_points', alterErr);
          }
        });
      }
    });

    db!.run(`
      CREATE TABLE IF NOT EXISTS ctf_timer (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        is_active INTEGER NOT NULL DEFAULT 0,
        is_infinite INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER NOT NULL DEFAULT 7200,
        started_at DATETIME DEFAULT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db!.run(
      `INSERT OR IGNORE INTO ctf_timer (id, is_active, is_infinite, duration_seconds, started_at)
       VALUES (1, 0, 0, 7200, NULL)`
    );

    db!.run(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    const persistAndPrintAdminPassword = (password: string): void => {
      db!.run(
        `INSERT INTO app_config (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [ADMIN_PASSWORD_CONFIG_KEY, password],
        (persistErr) => {
          if (persistErr) {
            console.error('Error storing admin password in app_config:', persistErr);
            return;
          }
          console.log(`Admin credentials: ${ADMIN_USERNAME} / ${password}`);
        }
      );
    };

    const ensureAdminPasswordAndPrint = (adminTeamId: number): void => {
      db!.get<{ value: string }>(
        'SELECT value FROM app_config WHERE key = ?',
        [ADMIN_PASSWORD_CONFIG_KEY],
        (configErr, existingPasswordConfig) => {
          if (configErr) {
            console.error('Error reading stored admin password from app_config:', configErr);
            return;
          }

          if (existingPasswordConfig?.value) {
            console.log(`Admin credentials: ${ADMIN_USERNAME} / ${existingPasswordConfig.value}`);
            return;
          }

          const rotatedPassword = generateSecurePassword();
          const rotatedHash = bcrypt.hashSync(rotatedPassword, 10);
          db!.run('UPDATE teams SET password = ? WHERE id = ?', [rotatedHash, adminTeamId], (updateErr) => {
            if (updateErr) {
              console.error('Error rotating admin password for existing database:', updateErr);
              return;
            }
            console.log('Generated secure admin password and synced existing admin account.');
            persistAndPrintAdminPassword(rotatedPassword);
          });
        }
      );
    };

    const ensureSingleAdminAccount = (): void => {
      db!.get<{ id: number }>('SELECT id FROM teams WHERE is_admin = 1 ORDER BY id ASC LIMIT 1', [], (adminLookupErr, adminTeam) => {
        if (adminLookupErr) {
          console.error('Error checking admin account:', adminLookupErr);
          return;
        }

        if (adminTeam) {
          ensureAdminPasswordAndPrint(adminTeam.id);
          return;
        }

        db!.get<{ id: number }>('SELECT id FROM teams WHERE name = ? COLLATE NOCASE ORDER BY id ASC LIMIT 1', [ADMIN_USERNAME], (reservedNameErr, reservedNameTeam) => {
          if (reservedNameErr) {
            console.error('Error checking reserved admin username:', reservedNameErr);
            return;
          }

          const generatedPassword = generateSecurePassword();
          const hashedPassword = bcrypt.hashSync(generatedPassword, 10);

          if (reservedNameTeam) {
            db!.run(
              'UPDATE teams SET email = ?, password = ?, is_admin = 1 WHERE id = ?',
              [ADMIN_EMAIL, hashedPassword, reservedNameTeam.id],
              (promoteErr) => {
                if (promoteErr) {
                  console.error('Error promoting reserved admin account:', promoteErr);
                  return;
                }
                console.log('Promoted reserved admin username to admin account.');
                persistAndPrintAdminPassword(generatedPassword);
              }
            );
            return;
          }

          db!.run(
            `INSERT INTO teams (name, email, password, is_admin, score, member_count)
             VALUES (?, ?, ?, 1, 0, 0)`,
            [ADMIN_USERNAME, ADMIN_EMAIL, hashedPassword],
            (insertAdminErr) => {
              if (insertAdminErr) {
                console.error('Error creating admin account:', insertAdminErr);
                return;
              }
              console.log('Generated secure admin password for first run.');
              persistAndPrintAdminPassword(generatedPassword);
            }
          );
        });
      });
    };

    db!.all<{ id: number }>('SELECT id FROM teams WHERE is_admin = 1 ORDER BY id ASC', [], (adminListErr, adminRows) => {
      if (adminListErr) {
        console.error('Error validating admin account uniqueness:', adminListErr);
        return;
      }

      const keepAdminId = adminRows[0]?.id ?? null;
      const afterCleanup = (): void => {
        db!.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_single_admin ON teams(is_admin) WHERE is_admin = 1', (indexErr) => {
          if (indexErr) {
            console.error('Error enforcing single admin index:', indexErr);
            return;
          }
          ensureSingleAdminAccount();
        });
      };

      if (adminRows.length > 1 && keepAdminId) {
        db!.run('UPDATE teams SET is_admin = 0 WHERE is_admin = 1 AND id != ?', [keepAdminId], (cleanupErr) => {
          if (cleanupErr) {
            console.error('Error normalizing duplicate admin accounts:', cleanupErr);
            return;
          }
          afterCleanup();
        });
        return;
      }

      afterCleanup();
    });

    db!.run(
      `INSERT OR IGNORE INTO team_members (team_id, username, is_primary)
        SELECT t.id, t.name, 1
        FROM teams t
        LEFT JOIN team_members tm ON tm.team_id = t.id
        WHERE tm.id IS NULL`,
      (missingErr) => {
        if (missingErr) {
          console.error('Error ensuring default team members:', missingErr);
        }
      }
    );

    db!.run(
      `UPDATE team_members
       SET is_primary = CASE
         WHEN LOWER(username) = LOWER((SELECT name FROM teams WHERE id = team_members.team_id)) THEN 1
         ELSE 0
       END`
    );

    db!.run(
      `INSERT INTO team_members (team_id, username, is_primary)
       SELECT t.id, t.name, 1
       FROM teams t
       WHERE NOT EXISTS (
         SELECT 1 FROM team_members tm WHERE tm.team_id = t.id AND tm.is_primary = 1
       )`
    );

    db!.run(
      `UPDATE teams
       SET member_count = (
         SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = teams.id AND tm.is_primary = 0
       )`
    );

  });
}

export function closeDatabase(): void {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
    db = null;
  }
}
