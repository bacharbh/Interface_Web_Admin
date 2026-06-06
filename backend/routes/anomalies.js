import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { saveAnomaly, getAnomalies, resolveAnomaly } from '../services/firebaseService.js';

const router = express.Router();

router.get('/', authMiddleware, async (_req, res) => {
  try {
    const data = await getAnomalies();
    res.json({ success: true, data });
  } catch {
    res.json({ success: true, data: [] });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const anomaly = {
      _id: `anomaly-${Date.now()}`,
      animalId: req.body.animalId || req.body.collar_id || 'unknown',
      farmId: req.body.farmId || 'default',
      score: typeof req.body.score === 'number' ? req.body.score : 1,
      features: req.body.features || {},
      detectedAt: new Date().toISOString(),
      resolved: false,
      ...req.body,
    };
    const saved = await saveAnomaly(anomaly);
    res.status(201).json({ success: true, data: saved });
  } catch {
    res.status(500).json({ success: false, error: "Impossible de créer l'anomalie" });
  }
});

router.patch('/:id/resolve', authMiddleware, async (req, res) => {
  try {
    const updated = await resolveAnomaly(req.params.id);
    if (!updated) return res.status(404).json({ success: false, error: 'Anomalie introuvable' });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: "Impossible de résoudre l'anomalie" });
  }
});

export default router;
