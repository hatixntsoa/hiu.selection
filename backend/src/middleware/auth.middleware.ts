import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JwtUser } from '../types';

export function authMiddleware(req: Request, res: Response, next: NextFunction): Response | void {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtUser;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
