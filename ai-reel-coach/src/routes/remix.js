const express = require('express');
const { protect: auth } = require('../middleware/auth');
const enforceLimit = require('../middleware/enforceLimit');
const { generate } = require('../controllers/remixController');

const router = express.Router();

router.post('/generate', auth, enforceLimit('remix'), generate);

module.exports = router;
