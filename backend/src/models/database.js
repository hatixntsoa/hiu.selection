const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, '../../ctf.db');

let db;

function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
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

function initializeDatabase() {
  if (!db) return;
  
  db.serialize(() => {
    // Teams table
    db.run(`
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        is_admin BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Challenges table
    db.run(`
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

    // Submissions table
    db.run(`
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

    // Create default admin user
    const adminPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
    db.run(
      `INSERT OR IGNORE INTO teams (name, email, password, is_admin, score) 
       VALUES (?, ?, ?, 1, 0)`,
      ['admin', 'admin@ctf.local', adminPassword]
    );

    // Insert sample challenges
    const sampleChallenges = [
      ['Welcome', 'Find the flag in the welcome message!', 'Misc', 50, 'flag{welcome_to_ctf}'],
      ['Basic Crypto', 'Decrypt this Caesar cipher: syne{pnrfne_rpelcgb}', 'Crypto', 100, 'flag{caesar_encryption}'],
      ['Web Basics', 'Inspect the page source to find the hidden flag', 'Web', 150, 'flag{view_source_master}'],
      ['Binary Explorer', 'Analyze the binary and extract the flag', 'Reverse', 200, 'flag{binary_explorer_solved}'],
      ['Database Dive', 'Query the database to uncover the secret', 'SQL', 250, 'flag{sql_master_2024}'],
    ];

    sampleChallenges.forEach(([title, desc, category, points, flag]) => {
      db.run(
        `INSERT OR IGNORE INTO challenges (title, description, category, points, flag) 
         VALUES (?, ?, ?, ?, ?)`,
        [title, desc, category, points, flag]
      );
    });
    
    console.log('Database initialization complete');
  });
}

function closeDatabase() {
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

module.exports = { getDatabase, closeDatabase };
