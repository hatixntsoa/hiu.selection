import { NextFunction, Request, Response } from 'express';
import { getDatabase } from '../models/database';

export function adminMiddleware(req: Request, res: Response, next: NextFunction): Response | void {
  const db = getDatabase();
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  db.get<{ is_admin: number }>('SELECT is_admin FROM teams WHERE id = ?', [userId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!row || !row.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  });
}
