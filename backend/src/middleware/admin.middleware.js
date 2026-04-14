const { getDatabase } = require('../models/database');

function adminMiddleware(req, res, next) {
  const db = getDatabase();
  
  db.get('SELECT is_admin FROM teams WHERE id = ?', [req.user.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row || !row.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  });
}

module.exports = { adminMiddleware };
