import { Request, Response } from 'express'
import Note from '../models/Note'

export const addNote = async (req: Request, res: Response) => {
    try {
        const { content, type } = req.body
        if (!content || !content.toString().trim()) return res.status(400).json({ error: 'Contenu requis' })

        const note = await Note.create({
            animalId: req.params.id,
            content: content.toString().trim(),
            author: (req as any).user?.id,
            type: (type as any) || 'note'
        })

        res.status(201).json(note)
    } catch (err) {
        res.status(500).json({ error: 'Impossible d\'ajouter la note' })
    }
}

export const getNotes = async (req: Request, res: Response) => {
    try {
        const notes = await Note.find({ animalId: req.params.id })
            .sort({ createdAt: -1 })
            .populate('author', 'name role')
            .lean()
        res.json(notes)
    } catch (err) {
        res.status(500).json({ error: 'Impossible de récupérer notes' })
    }
}
