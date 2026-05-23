import { Request, Response } from 'express'
import User from '../models/User'
import { z } from 'zod'

const CreateUserSchema = z.object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    role: z.enum(['admin', 'vet', 'farmer']),
    phone: z.string().optional()
})

export const getUsers = async (req: Request, res: Response) => {
    try {
        const page = Number((req.query.page as string) ?? '1')
        const limit = Number((req.query.limit as string) ?? '50')
        const role = req.query.role as string | undefined
        const search = req.query.search as string | undefined

        const filter: Record<string, any> = { active: true }
        if (role) filter.role = role
        if (search) filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ]

        const [users, total] = await Promise.all([
            User.find(filter)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            User.countDocuments(filter)
        ])

        res.json({ users, total, page, limit })
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération utilisateurs' })
    }
}

export const createUser = async (req: Request, res: Response) => {
    try {
        const parsed = CreateUserSchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: parsed.error.format() })

        const exists = await User.findOne({ email: parsed.data.email })
        if (exists) return res.status(409).json({ error: 'Email déjà utilisé' })

        const user = await User.create(parsed.data)
        res.status(201).json(user)
    } catch (err) {
        res.status(500).json({ error: 'Impossible de créer utilisateur' })
    }
}

export const updateUser = async (req: Request, res: Response) => {
    try {
        const parsed = CreateUserSchema.partial().safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: parsed.error.format() })

        const user = await User.findByIdAndUpdate(req.params.id, { $set: parsed.data }, { new: true, runValidators: true }).select('-password')
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })
        res.json(user)
    } catch (err) {
        res.status(500).json({ error: 'Impossible de mettre à jour utilisateur' })
    }
}

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true })
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: 'Impossible de supprimer utilisateur' })
    }
}
