import express from 'express';
import Joi from 'joi';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Stockage en mémoire (remplace Label MongoDB)
const labels = [];

const diagnoseSchema = Joi.object({
  animalId: Joi.string().required(),
  outcome: Joi.string().trim().required(),
  confirmedByVet: Joi.boolean().default(false),
  symptomOnsetTime: Joi.number().integer().min(0).optional(),
  notes: Joi.string().allow('').optional(),
  anomalyDate: Joi.string().optional(),
});

router.get('/', authMiddleware, async (_req, res) => {
  res.json({ success: true, data: labels.slice(-100).reverse() });
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { error, value } = diagnoseSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });

    const label = {
      _id: `label-${Date.now()}`,
      ...value,
      labelledBy: req.user?.id || null,
      createdAt: new Date().toISOString(),
    };
    labels.push(label);
    res.status(201).json({ success: true, data: label });
  } catch {
    res.status(500).json({ success: false, error: 'Erreur lors de la création du label' });
  }
});

export default router;
