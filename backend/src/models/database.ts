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
const ADMIN_SENDER_EMAIL_CONFIG_KEY = 'admin_sender_email';
const ADMIN_SENDER_APP_PASSWORD_CONFIG_KEY = 'admin_sender_app_password';
const ADMIN_OVA_LINK_CONFIG_KEY = 'admin_ova_link';
const ADMIN_PLATFORM_LINK_CONFIG_KEY = 'admin_platform_link';
const ADMIN_CREDENTIALS_TEMPLATE_CONFIG_KEY = 'admin_credentials_template';
const ADMIN_EMAIL_SUBJECT_CONFIG_KEY = 'admin_email_subject';
const DEFAULT_ADMIN_SENDER_EMAIL = 'c3lf.business@gmail.com';
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

const DEFAULT_TIMER_DURATION_SECONDS = 6 * 60 * 60;
const DEFAULT_TEAM_COUNT = 15;
const DEFAULT_TEAM_PASSWORD_LENGTH = 20;
const EASY_FIRST_BLOOD_POINTS = 100;
const EASY_SECOND_BLOOD_POINTS = 75;
const EASY_THIRD_BLOOD_POINTS = 50;
const MEDIUM_FIRST_BLOOD_POINTS = 200;
const MEDIUM_SECOND_BLOOD_POINTS = 150;
const MEDIUM_THIRD_BLOOD_POINTS = 100;
const HARD_FIRST_BLOOD_POINTS = 300;
const HARD_SECOND_BLOOD_POINTS = 225;
const HARD_THIRD_BLOOD_POINTS = 150;

let db: sqlite3.Database | null = null;

function generateSecurePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < ADMIN_PASSWORD_LENGTH; i += 1) {
    password += alphabet[crypto.randomInt(alphabet.length)];
  }
  return password;
}

function toTeamEmail(teamName: string): string {
  return `${teamName.toLowerCase()}@ctf.local`;
}

function generateHexPassword(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function defaultTeamPassword(): string {
  return generateHexPassword(DEFAULT_TEAM_PASSWORD_LENGTH);
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

    db!.run('ALTER TABLE teams ADD COLUMN member_count INTEGER DEFAULT 1', (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column name')) {
        console.error('Error ensuring teams.member_count:', alterErr);
      }
    });
    db!.run('ALTER TABLE teams ADD COLUMN team_leader_email TEXT', (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column name')) {
        console.error('Error ensuring teams.team_leader_email:', alterErr);
      }
    });
    db!.run('ALTER TABLE teams ADD COLUMN team_plain_password TEXT', (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column name')) {
        console.error('Error ensuring teams.team_plain_password:', alterErr);
      }
    });
    db!.run('ALTER TABLE teams ADD COLUMN creds_shared_email TEXT', (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column name')) {
        console.error('Error ensuring teams.creds_shared_email:', alterErr);
      }
    });

    db!.run(
      `UPDATE teams
       SET team_leader_email = LOWER(name) || '_leader@example.com'
       WHERE is_admin = 0 AND (team_leader_email IS NULL OR LENGTH(TRIM(team_leader_email)) = 0)`
    );

    db!.all<{ id: number }>(
      `SELECT id
       FROM teams
       WHERE is_admin = 0 AND (team_plain_password IS NULL OR LENGTH(TRIM(team_plain_password)) = 0)`,
      [],
      (lookupPasswordErr, teamsMissingPassword) => {
        if (lookupPasswordErr) {
          console.error('Error checking missing team plain passwords:', lookupPasswordErr);
          return;
        }
        teamsMissingPassword.forEach((row) => {
          const generatedPassword = defaultTeamPassword();
          const generatedHash = bcrypt.hashSync(generatedPassword, 10);
          db!.run('UPDATE teams SET password = ?, team_plain_password = ? WHERE id = ?', [generatedHash, generatedPassword, row.id], (syncErr) => {
            if (syncErr) {
              console.error('Error syncing team plain passwords:', syncErr);
            }
          });
        });
      }
    );

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
        problem_formulation TEXT,
        difficulty TEXT NOT NULL DEFAULT 'easy',
        challenge_type TEXT NOT NULL DEFAULT 'vm',
        category TEXT NOT NULL DEFAULT 'vm',
        first_blood_points INTEGER NOT NULL DEFAULT 100,
        second_blood_points INTEGER NOT NULL DEFAULT 75,
        default_points INTEGER NOT NULL DEFAULT 50,
        flag TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    type DefaultChallengeBase = {
      title: string;
      description: string;
      flag: string;
      difficulty: 'easy' | 'medium' | 'hard';
      first: number;
      second: number;
      third: number;
    };

    type DefaultChallenge = DefaultChallengeBase & {
      problemFormulation: string;
      challengeType: 'challenge' | 'vm';
      category: 'crypto' | 'forensics' | 'reverse' | 'pwn' | 'osint' | 'vm';
    };

    const vmSampleChallenges = [
      { title: 'Easy Web 01', description: 'Default easy challenge #1', flag: 'HIU_2026{easy_web_01}', difficulty: 'easy', first: EASY_FIRST_BLOOD_POINTS, second: EASY_SECOND_BLOOD_POINTS, third: EASY_THIRD_BLOOD_POINTS },
      { title: 'Easy Web 02', description: 'Default easy challenge #2', flag: 'HIU_2026{easy_web_02}', difficulty: 'easy', first: EASY_FIRST_BLOOD_POINTS, second: EASY_SECOND_BLOOD_POINTS, third: EASY_THIRD_BLOOD_POINTS },
      { title: 'Easy Crypto 01', description: 'Default easy challenge #3', flag: 'HIU_2026{easy_crypto_01}', difficulty: 'easy', first: EASY_FIRST_BLOOD_POINTS, second: EASY_SECOND_BLOOD_POINTS, third: EASY_THIRD_BLOOD_POINTS },
      { title: 'Easy Crypto 02', description: 'Default easy challenge #4', flag: 'HIU_2026{easy_crypto_02}', difficulty: 'easy', first: EASY_FIRST_BLOOD_POINTS, second: EASY_SECOND_BLOOD_POINTS, third: EASY_THIRD_BLOOD_POINTS },
      { title: 'Easy Reverse 01', description: 'Default easy challenge #5', flag: 'HIU_2026{easy_reverse_01}', difficulty: 'easy', first: EASY_FIRST_BLOOD_POINTS, second: EASY_SECOND_BLOOD_POINTS, third: EASY_THIRD_BLOOD_POINTS },
      { title: 'Easy Reverse 02', description: 'Default easy challenge #6', flag: 'HIU_2026{easy_reverse_02}', difficulty: 'easy', first: EASY_FIRST_BLOOD_POINTS, second: EASY_SECOND_BLOOD_POINTS, third: EASY_THIRD_BLOOD_POINTS },
      { title: 'Easy Misc 01', description: 'Default easy challenge #7', flag: 'HIU_2026{easy_misc_01}', difficulty: 'easy', first: EASY_FIRST_BLOOD_POINTS, second: EASY_SECOND_BLOOD_POINTS, third: EASY_THIRD_BLOOD_POINTS },
      { title: 'Easy Misc 02', description: 'Default easy challenge #8', flag: 'HIU_2026{easy_misc_02}', difficulty: 'easy', first: EASY_FIRST_BLOOD_POINTS, second: EASY_SECOND_BLOOD_POINTS, third: EASY_THIRD_BLOOD_POINTS },
      { title: 'Easy SQL 01', description: 'Default easy challenge #9', flag: 'HIU_2026{easy_sql_01}', difficulty: 'easy', first: EASY_FIRST_BLOOD_POINTS, second: EASY_SECOND_BLOOD_POINTS, third: EASY_THIRD_BLOOD_POINTS },
      { title: 'Easy Forensics 01', description: 'Default easy challenge #10', flag: 'HIU_2026{easy_forensics_01}', difficulty: 'easy', first: EASY_FIRST_BLOOD_POINTS, second: EASY_SECOND_BLOOD_POINTS, third: EASY_THIRD_BLOOD_POINTS },

      { title: 'Medium Web 01', description: 'Default medium challenge #1', flag: 'HIU_2026{medium_web_01}', difficulty: 'medium', first: MEDIUM_FIRST_BLOOD_POINTS, second: MEDIUM_SECOND_BLOOD_POINTS, third: MEDIUM_THIRD_BLOOD_POINTS },
      { title: 'Medium Web 02', description: 'Default medium challenge #2', flag: 'HIU_2026{medium_web_02}', difficulty: 'medium', first: MEDIUM_FIRST_BLOOD_POINTS, second: MEDIUM_SECOND_BLOOD_POINTS, third: MEDIUM_THIRD_BLOOD_POINTS },
      { title: 'Medium Crypto 01', description: 'Default medium challenge #3', flag: 'HIU_2026{medium_crypto_01}', difficulty: 'medium', first: MEDIUM_FIRST_BLOOD_POINTS, second: MEDIUM_SECOND_BLOOD_POINTS, third: MEDIUM_THIRD_BLOOD_POINTS },
      { title: 'Medium Crypto 02', description: 'Default medium challenge #4', flag: 'HIU_2026{medium_crypto_02}', difficulty: 'medium', first: MEDIUM_FIRST_BLOOD_POINTS, second: MEDIUM_SECOND_BLOOD_POINTS, third: MEDIUM_THIRD_BLOOD_POINTS },
      { title: 'Medium Reverse 01', description: 'Default medium challenge #5', flag: 'HIU_2026{medium_reverse_01}', difficulty: 'medium', first: MEDIUM_FIRST_BLOOD_POINTS, second: MEDIUM_SECOND_BLOOD_POINTS, third: MEDIUM_THIRD_BLOOD_POINTS },
      { title: 'Medium Reverse 02', description: 'Default medium challenge #6', flag: 'HIU_2026{medium_reverse_02}', difficulty: 'medium', first: MEDIUM_FIRST_BLOOD_POINTS, second: MEDIUM_SECOND_BLOOD_POINTS, third: MEDIUM_THIRD_BLOOD_POINTS },
      { title: 'Medium Misc 01', description: 'Default medium challenge #7', flag: 'HIU_2026{medium_misc_01}', difficulty: 'medium', first: MEDIUM_FIRST_BLOOD_POINTS, second: MEDIUM_SECOND_BLOOD_POINTS, third: MEDIUM_THIRD_BLOOD_POINTS },
      { title: 'Medium Misc 02', description: 'Default medium challenge #8', flag: 'HIU_2026{medium_misc_02}', difficulty: 'medium', first: MEDIUM_FIRST_BLOOD_POINTS, second: MEDIUM_SECOND_BLOOD_POINTS, third: MEDIUM_THIRD_BLOOD_POINTS },
      { title: 'Medium SQL 01', description: 'Default medium challenge #9', flag: 'HIU_2026{medium_sql_01}', difficulty: 'medium', first: MEDIUM_FIRST_BLOOD_POINTS, second: MEDIUM_SECOND_BLOOD_POINTS, third: MEDIUM_THIRD_BLOOD_POINTS },
      { title: 'Medium Forensics 01', description: 'Default medium challenge #10', flag: 'HIU_2026{medium_forensics_01}', difficulty: 'medium', first: MEDIUM_FIRST_BLOOD_POINTS, second: MEDIUM_SECOND_BLOOD_POINTS, third: MEDIUM_THIRD_BLOOD_POINTS },

      { title: 'Hard Web 01', description: 'Default hard challenge #1', flag: 'HIU_2026{hard_web_01}', difficulty: 'hard', first: HARD_FIRST_BLOOD_POINTS, second: HARD_SECOND_BLOOD_POINTS, third: HARD_THIRD_BLOOD_POINTS },
      { title: 'Hard Web 02', description: 'Default hard challenge #2', flag: 'HIU_2026{hard_web_02}', difficulty: 'hard', first: HARD_FIRST_BLOOD_POINTS, second: HARD_SECOND_BLOOD_POINTS, third: HARD_THIRD_BLOOD_POINTS },
      { title: 'Hard Crypto 01', description: 'Default hard challenge #3', flag: 'HIU_2026{hard_crypto_01}', difficulty: 'hard', first: HARD_FIRST_BLOOD_POINTS, second: HARD_SECOND_BLOOD_POINTS, third: HARD_THIRD_BLOOD_POINTS },
      { title: 'Hard Crypto 02', description: 'Default hard challenge #4', flag: 'HIU_2026{hard_crypto_02}', difficulty: 'hard', first: HARD_FIRST_BLOOD_POINTS, second: HARD_SECOND_BLOOD_POINTS, third: HARD_THIRD_BLOOD_POINTS },
      { title: 'Hard Reverse 01', description: 'Default hard challenge #5', flag: 'HIU_2026{hard_reverse_01}', difficulty: 'hard', first: HARD_FIRST_BLOOD_POINTS, second: HARD_SECOND_BLOOD_POINTS, third: HARD_THIRD_BLOOD_POINTS },
      { title: 'Hard Reverse 02', description: 'Default hard challenge #6', flag: 'HIU_2026{hard_reverse_02}', difficulty: 'hard', first: HARD_FIRST_BLOOD_POINTS, second: HARD_SECOND_BLOOD_POINTS, third: HARD_THIRD_BLOOD_POINTS },
      { title: 'Hard Misc 01', description: 'Default hard challenge #7', flag: 'HIU_2026{hard_misc_01}', difficulty: 'hard', first: HARD_FIRST_BLOOD_POINTS, second: HARD_SECOND_BLOOD_POINTS, third: HARD_THIRD_BLOOD_POINTS },
      { title: 'Hard Misc 02', description: 'Default hard challenge #8', flag: 'HIU_2026{hard_misc_02}', difficulty: 'hard', first: HARD_FIRST_BLOOD_POINTS, second: HARD_SECOND_BLOOD_POINTS, third: HARD_THIRD_BLOOD_POINTS },
      { title: 'Hard SQL 01', description: 'Default hard challenge #9', flag: 'HIU_2026{hard_sql_01}', difficulty: 'hard', first: HARD_FIRST_BLOOD_POINTS, second: HARD_SECOND_BLOOD_POINTS, third: HARD_THIRD_BLOOD_POINTS },
      { title: 'Hard Forensics 01', description: 'Default hard challenge #10', flag: 'HIU_2026{hard_forensics_01}', difficulty: 'hard', first: HARD_FIRST_BLOOD_POINTS, second: HARD_SECOND_BLOOD_POINTS, third: HARD_THIRD_BLOOD_POINTS }
    ] as DefaultChallengeBase[];

    const challengeCategories: Array<DefaultChallenge['category']> = ['crypto', 'forensics', 'reverse', 'pwn', 'osint'];
    const difficultyLevels: Array<DefaultChallengeBase['difficulty']> = ['easy', 'medium', 'hard'];

    const challengeSeeds: DefaultChallenge[] = challengeCategories.flatMap((category) =>
      difficultyLevels.map((difficulty) => {
        const base = `${category}_${difficulty}`;
        const points =
          difficulty === 'hard'
            ? { first: HARD_FIRST_BLOOD_POINTS, second: HARD_SECOND_BLOOD_POINTS, third: HARD_THIRD_BLOOD_POINTS }
            : difficulty === 'medium'
              ? { first: MEDIUM_FIRST_BLOOD_POINTS, second: MEDIUM_SECOND_BLOOD_POINTS, third: MEDIUM_THIRD_BLOOD_POINTS }
              : { first: EASY_FIRST_BLOOD_POINTS, second: EASY_SECOND_BLOOD_POINTS, third: EASY_THIRD_BLOOD_POINTS };
        const titleCategory = category === 'osint' ? 'OSINT' : category.charAt(0).toUpperCase() + category.slice(1);
        const titleDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        return {
          title: `${titleCategory} ${titleDifficulty}`,
          description: `${titleCategory} challenge at ${titleDifficulty} level.`,
          problemFormulation: `Analyze the provided ${titleCategory} artifact and submit the exact flag.`,
          flag: `HIU_2026{challenge_${base}_01}`,
          difficulty,
          challengeType: 'challenge',
          category,
          first: points.first,
          second: points.second,
          third: points.third
        };
      })
    );

    const sampleChallenges: DefaultChallenge[] = [
      ...vmSampleChallenges.map((challenge) => ({
        ...challenge,
        problemFormulation: '',
        challengeType: 'vm' as const,
        category: 'vm' as const
      })),
      ...challengeSeeds
    ];

    const defaultCategories = ['Web', 'Crypto', 'Reverse', 'Misc', 'SQL', 'Forensics', 'Pwn', 'OSINT'];

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
      const hasDifficulty = challengeColumns.some((column) => column.name === 'difficulty');
      if (!hasDifficulty) {
        migrationSteps.push({
          sql: `ALTER TABLE challenges ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'easy'`,
          errorLabel: 'Error adding challenges.difficulty'
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
      const hasProblemFormulation = challengeColumns.some((column) => column.name === 'problem_formulation');
      if (!hasProblemFormulation) {
        migrationSteps.push({
          sql: 'ALTER TABLE challenges ADD COLUMN problem_formulation TEXT',
          errorLabel: 'Error adding challenges.problem_formulation'
        });
      }
      const hasChallengeType = challengeColumns.some((column) => column.name === 'challenge_type');
      if (!hasChallengeType) {
        migrationSteps.push({
          sql: `ALTER TABLE challenges ADD COLUMN challenge_type TEXT NOT NULL DEFAULT 'vm'`,
          errorLabel: 'Error adding challenges.challenge_type'
        });
      }
      const hasCategory = challengeColumns.some((column) => column.name === 'category');
      if (!hasCategory) {
        migrationSteps.push({
          sql: `ALTER TABLE challenges ADD COLUMN category TEXT NOT NULL DEFAULT 'vm'`,
          errorLabel: 'Error adding challenges.category'
        });
      }
      migrationSteps.push({
        sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_public_id ON challenges(public_id)',
        errorLabel: 'Error creating challenges public_id index'
      });
      migrationSteps.push({
        sql: 'CREATE INDEX IF NOT EXISTS idx_challenges_type ON challenges(challenge_type)',
        errorLabel: 'Error creating challenges type index'
      });

      defaultCategories.forEach((category) => {
        migrationSteps.push({
          sql: 'INSERT OR IGNORE INTO categories (name) VALUES (?)',
          params: [category],
          errorLabel: 'Error seeding categories'
        });
      });

      sampleChallenges.forEach((challenge) => {
        migrationSteps.push({
          sql: `INSERT INTO challenges (
                  public_id, title, description, problem_formulation, flag, difficulty, challenge_type, category, first_blood_points, second_blood_points, default_points
                )
                SELECT lower(hex(randomblob(3))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                WHERE NOT EXISTS (
                  SELECT 1 FROM challenges WHERE LOWER(TRIM(flag)) = LOWER(TRIM(?))
                )`,
          params: [
            challenge.title,
            challenge.description,
            challenge.problemFormulation,
            challenge.flag,
            challenge.difficulty,
            challenge.challengeType,
            challenge.category,
            challenge.first,
            challenge.second,
            challenge.third,
            challenge.flag
          ],
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
              SET difficulty = 'easy'
              WHERE LOWER(TRIM(COALESCE(difficulty, ''))) NOT IN ('easy', 'medium', 'hard')`,
        errorLabel: 'Error normalizing challenges.difficulty'
      });
      migrationSteps.push({
        sql: `UPDATE challenges
              SET challenge_type = 'vm'
              WHERE LOWER(TRIM(COALESCE(challenge_type, ''))) NOT IN ('challenge', 'vm')`,
        errorLabel: 'Error normalizing challenges.challenge_type'
      });
      migrationSteps.push({
        sql: `UPDATE challenges
              SET category = CASE
                WHEN challenge_type = 'vm' THEN 'vm'
                WHEN LOWER(TRIM(COALESCE(category, ''))) IN ('crypto', 'forensics', 'reverse', 'pwn', 'osint') THEN LOWER(TRIM(category))
                ELSE 'crypto'
              END`,
        errorLabel: 'Error normalizing challenges.category'
      });
      migrationSteps.push({
        sql: `UPDATE challenges
              SET first_blood_points = CASE LOWER(TRIM(COALESCE(difficulty, 'easy')))
                WHEN 'hard' THEN ${HARD_FIRST_BLOOD_POINTS}
                WHEN 'medium' THEN ${MEDIUM_FIRST_BLOOD_POINTS}
                ELSE ${EASY_FIRST_BLOOD_POINTS}
              END
              WHERE first_blood_points IS NULL OR first_blood_points <= 0`,
        errorLabel: 'Error normalizing challenges.first_blood_points'
      });
      migrationSteps.push({
        sql: `UPDATE challenges
              SET second_blood_points = CASE LOWER(TRIM(COALESCE(difficulty, 'easy')))
                WHEN 'hard' THEN ${HARD_SECOND_BLOOD_POINTS}
                WHEN 'medium' THEN ${MEDIUM_SECOND_BLOOD_POINTS}
                ELSE ${EASY_SECOND_BLOOD_POINTS}
              END
              WHERE second_blood_points IS NULL OR second_blood_points <= 0`,
        errorLabel: 'Error normalizing challenges.second_blood_points'
      });
      migrationSteps.push({
        sql: `UPDATE challenges
              SET default_points = CASE LOWER(TRIM(COALESCE(difficulty, 'easy')))
                WHEN 'hard' THEN ${HARD_THIRD_BLOOD_POINTS}
                WHEN 'medium' THEN ${MEDIUM_THIRD_BLOOD_POINTS}
                ELSE ${EASY_THIRD_BLOOD_POINTS}
              END
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
        duration_seconds INTEGER NOT NULL DEFAULT ${DEFAULT_TIMER_DURATION_SECONDS},
        started_at DATETIME DEFAULT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db!.run(
      `INSERT OR IGNORE INTO ctf_timer (id, is_active, is_infinite, duration_seconds, started_at)
       VALUES (1, 0, 0, ${DEFAULT_TIMER_DURATION_SECONDS}, NULL)`
    );

    db!.run(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    const defaultSenderAppPassword = defaultTeamPassword();
    db!.run(
      `INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`,
      [ADMIN_SENDER_EMAIL_CONFIG_KEY, DEFAULT_ADMIN_SENDER_EMAIL]
    );
    db!.run(
      `INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`,
      [ADMIN_SENDER_APP_PASSWORD_CONFIG_KEY, defaultSenderAppPassword]
    );
    db!.run(
      `INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`,
      [ADMIN_OVA_LINK_CONFIG_KEY, DEFAULT_ADMIN_OVA_LINK]
    );
    db!.run(
      `INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`,
      [ADMIN_PLATFORM_LINK_CONFIG_KEY, DEFAULT_ADMIN_PLATFORM_LINK]
    );
    db!.run(
      `INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`,
      [ADMIN_CREDENTIALS_TEMPLATE_CONFIG_KEY, DEFAULT_CREDENTIALS_TEMPLATE]
    );
    db!.run(
      `INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`,
      [ADMIN_EMAIL_SUBJECT_CONFIG_KEY, DEFAULT_ADMIN_EMAIL_SUBJECT]
    );

    for (let index = 1; index <= DEFAULT_TEAM_COUNT; index += 1) {
      const teamName = `team${index}`;
      const plainPassword = defaultTeamPassword();
      const hashedPassword = bcrypt.hashSync(plainPassword, 10);
      const leaderEmail = `${teamName.toLowerCase()}_leader@example.com`;
      db!.run(
        `INSERT INTO teams (name, email, password, team_plain_password, team_leader_email, score, member_count, is_admin)
         SELECT ?, ?, ?, ?, ?, 0, 0, 0
         WHERE NOT EXISTS (
           SELECT 1 FROM teams WHERE name = ? COLLATE NOCASE
         )`,
        [teamName, toTeamEmail(teamName), hashedPassword, plainPassword, leaderEmail, teamName],
        (seedErr) => {
          if (seedErr) {
            console.error('Error seeding default teams:', seedErr);
          }
        }
      );
    }

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
              'UPDATE teams SET email = ?, password = ?, team_plain_password = ?, is_admin = 1 WHERE id = ?',
              [ADMIN_EMAIL, hashedPassword, generatedPassword, reservedNameTeam.id],
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
            `INSERT INTO teams (name, email, password, team_plain_password, is_admin, score, member_count)
             VALUES (?, ?, ?, ?, 1, 0, 0)`,
            [ADMIN_USERNAME, ADMIN_EMAIL, hashedPassword, generatedPassword],
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
