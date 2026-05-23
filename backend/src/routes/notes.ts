import { Router } from 'express'
const { addNote, getNotes } = require('../controllers/notes.controller')
const { authenticate } = require('../middleware/auth')

const router = Router({ mergeParams: true })

router.get('/', authenticate, getNotes)
router.post('/', authenticate, addNote)

export = router
