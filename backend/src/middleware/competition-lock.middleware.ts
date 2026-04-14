import { NextFunction, Request, Response } from 'express';
import { getDatabase } from '../models/database';
import { getCtfTimerState } from '../models/timer';

export async function competitionLockMiddleware(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
  const userId = req.user?.id;
  if (!userId) {
    return next();
  }

  const db = getDatabase();
  db.get<{ is_admin: number }>('SELECT is_admin FROM teams WHERE id = ?', [userId], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (row.is_admin === 1) {
      return next();
    }

    try {
      const timer = await getCtfTimerState();
      if (!timer.canSubmit) {
        return res.status(403).json({ error: 'CTF is finished. Access is locked for team accounts.' });
      }
      return next();
    } catch {
      return res.status(500).json({ error: 'Database error' });
    }
  });
}
