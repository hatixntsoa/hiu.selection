import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcrypt';

const sqlite = sqlite3.verbose();
const DB_PATH = path.join(__dirname, '../../ctf.db');

let db: sqlite3.Database | null = null;

export function getDatabase(): sqlite3.Database {
  if (!db) {
    db = new sqlite.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
      }
    });
    initializeDatabase();
  }
  return db;
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
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        points INTEGER NOT NULL,
        flag TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db!.run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        challenge_id INTEGER NOT NULL,
        submitted_flag TEXT,
        is_correct BOOLEAN,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id),
        FOREIGN KEY (challenge_id) REFERENCES challenges(id)
      )
    `);

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

    const adminPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
    db!.run(
      `INSERT OR IGNORE INTO teams (name, email, password, is_admin, score) 
       VALUES (?, ?, ?, 1, 0)`,
      ['admin', 'admin@ctf.local', adminPassword]
    );

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

    const sampleChallenges: Array<[string, string, string, number, string]> = [
      ['Welcome', 'Find the flag in the welcome message!', 'Misc', 50, 'HIU_2026{welcome_to_ctf}'],
      ['Basic Crypto', 'Decrypt this Caesar cipher: syne{pnrfne_rpelcgb}', 'Crypto', 100, 'HIU_2026{caesar_encryption}'],
      ['Web Basics', 'Inspect the page source to find the hidden flag', 'Web', 150, 'HIU_2026{view_source_master}'],
      ['Binary Explorer', 'Analyze the binary and extract the flag', 'Reverse', 200, 'HIU_2026{binary_explorer_solved}'],
      ['Database Dive', 'Query the database to uncover the secret', 'SQL', 250, 'HIU_2026{sql_master_2024}']
    ];

    const defaultCategories = ['Web', 'Crypto', 'Reverse', 'Misc', 'SQL', 'Forensics'];
    defaultCategories.forEach((category) => {
      db!.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [category]);
    });

    sampleChallenges.forEach(([title, desc, category, points, flag]) => {
      db!.run(
        `INSERT OR IGNORE INTO challenges (title, description, category, points, flag) 
         VALUES (?, ?, ?, ?, ?)`,
        [title, desc, category, points, flag]
      );
    });

    db!.run(`
      UPDATE challenges
      SET flag = REPLACE(REPLACE(flag, 'FLAG{', 'HIU_2026{'), 'flag{', 'HIU_2026{')
      WHERE flag LIKE '%flag{%' COLLATE NOCASE
    `);
    db!.run(`
      UPDATE challenges
      SET description = REPLACE(REPLACE(description, 'FLAG{', 'HIU_2026{'), 'flag{', 'HIU_2026{')
      WHERE description LIKE '%flag{%' COLLATE NOCASE
    `);

    console.log('Database initialization complete');
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
