const express = require('express');
const router = express.Router();
const { 
  getAllChallenges, 
  getChallengeById, 
  createChallenge, 
  updateChallenge, 
  deleteChallenge 
} = require('../controllers/challenge.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { adminMiddleware } = require('../middleware/admin.middleware');

// Public routes
router.get('/', getAllChallenges);
router.get('/:id', getChallengeById);

// Admin only routes
router.post('/', authMiddleware, adminMiddleware, createChallenge);
router.put('/:id', authMiddleware, adminMiddleware, updateChallenge);
router.delete('/:id', authMiddleware, adminMiddleware, deleteChallenge);

module.exports = router;
