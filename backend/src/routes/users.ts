import { Router } from 'express'
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/users.controller')

// Reuse existing middleware from backend/middleware/auth.js via TS wrapper
const { authenticate, requireRole } = require('../middleware/auth')

const router = Router()

router.get('/', authenticate, getUsers)
router.post('/', authenticate, requireRole('admin'), createUser)
router.put('/:id', authenticate, requireRole('admin'), updateUser)
router.delete('/:id', authenticate, requireRole('admin'), deleteUser)

export = router
