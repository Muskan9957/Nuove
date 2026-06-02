const router = require('express').Router()
const { protect: auth } = require('../middleware/auth')
const { get, getGreeting, getAudio } = require('../controllers/trendingController')

router.get('/greeting', auth, getGreeting)
router.get('/audio',    auth, getAudio)
router.get('/',         auth, get)

module.exports = router
