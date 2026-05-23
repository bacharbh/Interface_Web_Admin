import { Router } from 'express'

// Proxy to existing CommonJS sheep router to provide a compatibility alias
const sheepRouter = require('../../routes/sheep')

const router = Router()

router.use('/', sheepRouter)

export = router
