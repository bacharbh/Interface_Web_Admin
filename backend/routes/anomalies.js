import express from 'express';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Stockage en mémoire (remplace AnomalyEvent MongoDB)
const anomalies = [];

router.get('/', authMiddleware, async (_req, res) => {
  res.json({ success: true, data: anomalies.slice(-100).reverse() });
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
    anomalies.push(anomaly);
    res.status(201).json({ success: true, data: anomaly });
  } catch {
    res.status(500).json({ success: false, error: "Impossible de créer l'anomalie" });
  }
});

router.patch('/:id/resolve', authMiddleware, async (req, res) => {
  try {
    const anomaly = anomalies.find(a => a._id === req.params.id);
    if (!anomaly) return res.status(404).json({ success: false, error: 'Anomalie introuvable' });
    anomaly.resolved = true;
    anomaly.resolvedAt = new Date().toISOString();
    res.json({ success: true, data: anomaly });
  } catch {
    res.status(500).json({ success: false, error: "Impossible de résoudre l'anomalie" });
  }
});

export default router;
