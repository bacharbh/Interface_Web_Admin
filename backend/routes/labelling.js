import express from 'express';
import Joi from 'joi';
import authMiddleware from '../middleware/auth.js';
import { saveLabel, getLabels, getLabelsCount } from '../services/firebaseService.js';

const router = express.Router();

const diagnoseSchema = Joi.object({
  animalId: Joi.string().required(),
  outcome: Joi.string().trim().required(),
  confirmedByVet: Joi.boolean().default(false),
  symptomOnsetTime: Joi.number().integer().min(0).optional(),
  notes: Joi.string().allow('').optional(),
  anomalyDate: Joi.string().optional(),
  severity: Joi.string().optional(),
  type: Joi.string().optional(),
  windowStart: Joi.string().optional(),
  windowEnd: Joi.string().optional(),
});

// GET /api/labelling — list (auth required)
router.get('/', authMiddleware, async (_req, res) => {
  try {
    const labels = await getLabels();
    res.json({ success: true, data: labels.slice(0, 100) });
  } catch {
    res.json({ success: true, data: [] });
  }
});

// GET /api/labelling/count — public, no auth needed
router.get('/count', async (_req, res) => {
  try {
    const count = await getLabelsCount();
    res.json({ success: true, count });
  } catch {
    res.json({ success: true, count: 0 });
  }
});

async function createLabel(req, res) {
  try {
    const { error, value } = diagnoseSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });

    const label = {
      _id: `label-${Date.now()}`,
      ...value,
      labelledBy: req.user?.id || null,
      createdAt: new Date().toISOString(),
    };

    const saved = await saveLabel(label);
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error('[Labelling] save error:', err.message);
    res.status(500).json({ success: false, error: 'Erreur lors de la création du label' });
  }
}

router.post('/', authMiddleware, createLabel);
router.post('/submit-diagnostic', authMiddleware, createLabel);

export default router;
