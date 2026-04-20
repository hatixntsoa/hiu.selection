import { Router } from 'express';
import {
  addTeamMember,
  deleteTeamByAdmin,
  deleteTeamMember,
  getAdminSenderConfig,
  getTeamEditByAdmin,
  getMe,
  getTeamDetailsByAdmin,
  listTeamMembers,
  login,
  register,
  shareTeamCredentialsByAdmin,
  updateAdminSenderConfig,
  updateTeamByAdmin,
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
router.get('/admin/teams/:teamId', authMiddleware, adminMiddleware, getTeamDetailsByAdmin);
router.get('/admin/teams/:teamId/edit', authMiddleware, adminMiddleware, getTeamEditByAdmin);
router.put('/admin/teams/:teamId', authMiddleware, adminMiddleware, updateTeamByAdmin);
router.post('/admin/teams/:teamId/share', authMiddleware, adminMiddleware, shareTeamCredentialsByAdmin);
router.delete('/admin/teams/:teamId', authMiddleware, adminMiddleware, deleteTeamByAdmin);
router.get('/admin/sender-config', authMiddleware, adminMiddleware, getAdminSenderConfig);
router.put('/admin/sender-config', authMiddleware, adminMiddleware, updateAdminSenderConfig);

export default router;
