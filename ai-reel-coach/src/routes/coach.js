const express = require('express');
const { protect: auth } = require('../middleware/auth');
const enforceLimit = require('../middleware/enforceLimit');
const { chat, listConversations, getConversation, deleteConversation } = require('../controllers/coachController');

const router = express.Router();

router.post('/chat',                 auth, enforceLimit('coach'), chat);
router.get('/conversations',         auth, listConversations);
router.get('/conversations/:id',     auth, getConversation);
router.delete('/conversations/:id',  auth, deleteConversation);

module.exports = router;
