const express = require('express');
const { protect: auth } = require('../middleware/auth');
const enforceLimit = require('../middleware/enforceLimit');
const { chat, getHistory, saveMessage } = require('../controllers/coachController');

const router = express.Router();

router.post('/chat',    auth, enforceLimit('coach'), chat);
router.get('/history',  auth, getHistory);
router.post('/history', auth, saveMessage);

module.exports = router;
