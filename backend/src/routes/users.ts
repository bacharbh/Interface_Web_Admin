import { Router } from 'express'
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/users.controller.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, getUsers)
router.post('/', authenticate, requireRole('admin'), createUser)
router.put('/:id', authenticate, requireRole('admin'), updateUser)
router.delete('/:id', authenticate, requireRole('admin'), deleteUser)

export default router

