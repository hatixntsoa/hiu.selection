const { getDatabase } = require('../models/database');

function getScoreboard(req, res) {
  const db = getDatabase();

  db.all(
    'SELECT id, name, score, created_at FROM teams WHERE is_admin = 0 ORDER BY score DESC, created_at ASC',
    [],
    (err, teams) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Add rank
      const scoreboard = teams.map((team, index) => ({
        ...team,
        rank: index + 1
      }));

      res.json({ scoreboard });
    }
  );
}

function getActivityFeed(req, res) {
  const db = getDatabase();

  db.all(
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

function getStats(req, res) {
  const db = getDatabase();

  const stats = {};

  db.get('SELECT COUNT(*) as total FROM teams WHERE is_admin = 0', [], (err, row) => {
    stats.totalTeams = row?.total || 0;

    db.get('SELECT COUNT(*) as total FROM challenges', [], (err, row) => {
      stats.totalChallenges = row?.total || 0;

      db.get('SELECT COUNT(*) as total FROM submissions WHERE is_correct = 1', [], (err, row) => {
        stats.totalSolves = row?.total || 0;

        db.get('SELECT MAX(score) as highest_score FROM teams WHERE is_admin = 0', [], (err, row) => {
          stats.highestScore = row?.highest_score || 0;

          res.json({ stats });
        });
      });
    });
  });
}

module.exports = { getScoreboard, getActivityFeed, getStats };
