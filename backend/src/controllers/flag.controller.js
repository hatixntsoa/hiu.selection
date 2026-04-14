const { getDatabase } = require('../models/database');

function submitFlag(req, res, io) {
  const { challengeId, flag } = req.body;
  const teamId = req.user.id;

  if (!challengeId || !flag) {
    return res.status(400).json({ error: 'Challenge ID and flag are required' });
  }

  const db = getDatabase();

  // Check if already solved
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

      // Get challenge flag
      db.get('SELECT * FROM challenges WHERE id = ?', [challengeId], (err, challenge) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!challenge) {
          return res.status(404).json({ error: 'Challenge not found' });
        }

        const isCorrect = flag.trim().toLowerCase() === challenge.flag.trim().toLowerCase();

        // Record submission
        db.run(
          'INSERT INTO submissions (team_id, challenge_id, submitted_flag, is_correct) VALUES (?, ?, ?, ?)',
          [teamId, challengeId, flag, isCorrect ? 1 : 0],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to submit flag' });
            }

            if (isCorrect) {
              // Update team score
              db.run('UPDATE teams SET score = score + ? WHERE id = ?', [challenge.points, teamId]);

              // Get team name for activity feed
              db.get('SELECT name FROM teams WHERE id = ?', [teamId], (err, team) => {
                const activity = {
                  teamName: team?.name || 'Unknown',
                  challengeTitle: challenge.title,
                  points: challenge.points,
                  timestamp: new Date().toISOString()
                };

                // Emit real-time update
                io.emit('flag_captured', activity);
                io.emit('scoreboard_update');
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

function getSubmissionHistory(req, res) {
  const teamId = req.user.id;
  const db = getDatabase();

  db.all(
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

module.exports = { submitFlag, getSubmissionHistory };
