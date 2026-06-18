const express = require('express');
const { protect: auth } = require('../middleware/auth');
const enforceLimit = require('../middleware/enforceLimit');
const { generate } = require('../controllers/captionController');

const router = express.Router();

router.post('/generate', auth, enforceLimit('captions'), generate);

module.exports = router;
