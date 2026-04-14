import { Router } from 'express';
import {
  addTeamMember,
  deleteTeamByAdmin,
  deleteTeamMember,
  getMe,
  listTeamMembers,
  login,
  register,
  updateTeam,
  updateTeamMember
} from '../controllers/auth.controller';
import { adminMiddleware } from '../middleware/admin.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.put('/team', authMiddleware, updateTeam);
router.get('/team/members', authMiddleware, listTeamMembers);
router.post('/team/members', authMiddleware, addTeamMember);
router.put('/team/members/:memberId', authMiddleware, updateTeamMember);
router.delete('/team/members/:memberId', authMiddleware, deleteTeamMember);
router.delete('/admin/teams/:teamId', authMiddleware, adminMiddleware, deleteTeamByAdmin);

export default router;
