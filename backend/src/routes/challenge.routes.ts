import { Router } from 'express';
import {
  createCategory,
  getAllChallenges,
  getCategories,
  getChallengeById,
  createChallenge,
  importFlags,
  updateChallenge,
  deleteChallenge
} from '../controllers/challenge.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { competitionLockMiddleware } from '../middleware/competition-lock.middleware';

const router = Router();

router.get('/', authMiddleware, competitionLockMiddleware, getAllChallenges);
router.post('/import', authMiddleware, competitionLockMiddleware, adminMiddleware, importFlags);
router.get('/categories', getCategories);
router.get('/:id', authMiddleware, competitionLockMiddleware, getChallengeById);
router.post('/', authMiddleware, competitionLockMiddleware, adminMiddleware, createChallenge);
router.post('/categories', authMiddleware, adminMiddleware, createCategory);
router.put('/:id', authMiddleware, competitionLockMiddleware, adminMiddleware, updateChallenge);
router.delete('/:id', authMiddleware, competitionLockMiddleware, adminMiddleware, deleteChallenge);

export default router;
