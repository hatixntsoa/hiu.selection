import { Router } from 'express';
import {
  getAllChallenges,
  getChallengeById,
  createChallenge,
  updateChallenge,
  deleteChallenge
} from '../controllers/challenge.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();

router.get('/', getAllChallenges);
router.get('/:id', getChallengeById);
router.post('/', authMiddleware, adminMiddleware, createChallenge);
router.put('/:id', authMiddleware, adminMiddleware, updateChallenge);
router.delete('/:id', authMiddleware, adminMiddleware, deleteChallenge);

export default router;
