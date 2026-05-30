import express from 'express';
import AnomalyEvent from '../models/AnomalyEvent.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, async (_req, res) => {
    try {
        const anomalies = await AnomalyEvent.find()
            .sort({ detectedAt: -1 })
            .limit(100)
            .lean();

        res.json({ success: true, data: anomalies });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Impossible de charger les anomalies' });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const anomaly = await AnomalyEvent.create({
            ...req.body,
            animalId: req.body.animalId || req.body.collar_id || req.body.id || 'unknown',
            farmId: req.body.farmId || req.user?.farmId || req.user?.id || 'default',
            score: typeof req.body.score === 'number' ? req.body.score : 1,
            detectedAt: new Date(),
            resolved: false,
        });

        res.status(201).json({ success: true, data: anomaly });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Impossible de créer l\'anomalie' });
    }
});

router.patch('/:id/resolve', authMiddleware, async (req, res) => {
    try {
        const anomaly = await AnomalyEvent.findByIdAndUpdate(
            req.params.id,
            { resolved: true, resolvedAt: new Date() },
            { new: true }
        );

        res.json({ success: true, data: anomaly });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Impossible de résoudre l\'anomalie' });
    }
});

export default router;