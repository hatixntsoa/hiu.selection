import { Router } from 'express';
import { addTeamMember, getMe, listTeamMembers, login, register, updateTeam } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.put('/team', authMiddleware, updateTeam);
router.get('/team/members', authMiddleware, listTeamMembers);
router.post('/team/members', authMiddleware, addTeamMember);

export default router;
