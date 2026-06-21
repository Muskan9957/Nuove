const router = require('express').Router()
const { protect: auth } = require('../middleware/auth')
const { get, getGreeting } = require('../controllers/trendingController')

router.get('/greeting', auth, getGreeting)
router.get('/',         auth, get)

module.exports = router
