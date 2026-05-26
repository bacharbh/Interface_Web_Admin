import { Router } from 'express';
import User from '../../models/User.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (_req, res) => {
    try {
        const users = await User.find({ isActive: true }).select('-password').sort({ createdAt: -1 }).lean();
        return res.json({ users });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur récupération utilisateurs' });
    }
});

router.post('/', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const user = await User.create(req.body);
        return res.status(201).json(user);
    } catch (error) {
        return res.status(500).json({ error: 'Impossible de créer utilisateur' });
    }
});

router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true }).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        return res.json(user);
    } catch (error) {
        return res.status(500).json({ error: 'Impossible de mettre à jour utilisateur' });
    }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Impossible de supprimer utilisateur' });
    }
});

export default router;