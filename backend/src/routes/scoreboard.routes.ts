import { Router } from 'express';
import { getScoreboard, getActivityFeed, getStats } from '../controllers/scoreboard.controller';

const router = Router();

router.get('/', getScoreboard);
router.get('/activity', getActivityFeed);
router.get('/stats', getStats);

export default router;
