import { Router } from 'express';
import { Server } from 'socket.io';
import { submitFlag, getSubmissionHistory } from '../controllers/flag.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
let io: Server | undefined;

export function setIO(ioInstance: Server): void {
  io = ioInstance;
}

router.post('/submit', authMiddleware, (req, res) => {
  submitFlag(req, res, io);
});

router.get('/history', authMiddleware, getSubmissionHistory);

export { router };
