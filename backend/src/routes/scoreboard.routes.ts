import { Router } from 'express';
import {
  addTimeToTimer,
  getActivityFeed,
  getScoreboard,
  getStats,
  getTimer,
  makeTimerInfinite,
  restartTimer,
  startTimer,
  updateTimerDuration
} from '../controllers/scoreboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { competitionLockMiddleware } from '../middleware/competition-lock.middleware';

const router = Router();

router.get('/', getScoreboard);
router.get('/activity', authMiddleware, competitionLockMiddleware, getActivityFeed);
router.get('/stats', authMiddleware, competitionLockMiddleware, getStats);
router.get('/timer', getTimer);
router.put('/timer', authMiddleware, adminMiddleware, updateTimerDuration);
router.post('/timer/start', authMiddleware, adminMiddleware, startTimer);
router.post('/timer/restart', authMiddleware, adminMiddleware, restartTimer);
router.post('/timer/add-time', authMiddleware, adminMiddleware, addTimeToTimer);
router.post('/timer/infinite', authMiddleware, adminMiddleware, makeTimerInfinite);

export default router;
