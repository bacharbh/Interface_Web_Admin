import { Router } from 'express'
const { getAnimalHealth, getBatteryRUL } = require('../controllers/ai.controller')
const { authenticate } = require('../middleware/auth')

const router = Router()

router.get('/health/:id', authenticate, getAnimalHealth)
router.get('/battery/:deviceId', authenticate, getBatteryRUL)

export = router
