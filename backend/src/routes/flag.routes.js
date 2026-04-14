const express = require('express');
const router = express.Router();
const { submitFlag, getSubmissionHistory } = require('../controllers/flag.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Need to pass io instance, will be set up in server.js
let io;

function setIO(ioInstance) {
  io = ioInstance;
}

router.post('/submit', authMiddleware, (req, res) => {
  submitFlag(req, res, io);
});
router.get('/history', authMiddleware, getSubmissionHistory);

module.exports = { router, setIO };
