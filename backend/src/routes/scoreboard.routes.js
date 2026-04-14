const express = require('express');
const router = express.Router();
const { getScoreboard, getActivityFeed, getStats } = require('../controllers/scoreboard.controller');

router.get('/', getScoreboard);
router.get('/activity', getActivityFeed);
router.get('/stats', getStats);

module.exports = router;
