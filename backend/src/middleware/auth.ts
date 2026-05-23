import { Request, Response, NextFunction } from 'express'

// Reuse existing CommonJS auth implementation from backend/middleware/auth.js
const auth = require('../../middleware/auth.js')

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    return auth.authenticate(req, res, next)
}

export const requireRole = (role: string) => {
    return (req: Request, res: Response, next: NextFunction) => auth.requireRole(role)(req, res, next)
}

export default auth
