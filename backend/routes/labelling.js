import express from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import Label from '../models/Label.js';
import authMiddleware from '../middleware/auth.js';

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

const toDate = (value, fallback) => {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const normalizeOutcome = (value) => {
    const normalized = String(value || '').trim().toLowerCase();

    switch (normalized) {
        case 'healthy': return 'Healthy';
        case 'fever': return 'Fever';
        case 'respiratory illness': return 'Respiratory illness';
        case 'digestive disorder': return 'Digestive disorder';
        case 'injury': return 'Injury';
        default: return 'Unknown';
    }
};

const resolveLabelledBy = (userId) => {
    if (typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)) {
        return userId;
    }

    return new mongoose.Types.ObjectId();
};

router.post('/diagnose', authMiddleware, async (req, res) => {
    try {
        const { error, value } = diagnoseSchema.validate(req.body, { stripUnknown: true });
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const baseDate = toDate(value.anomalyDate, new Date());
        const windowStart = toDate(value.windowStart, new Date(baseDate.getTime() - 24 * 60 * 60 * 1000));
        const windowEnd = toDate(value.windowEnd, new Date(baseDate.getTime() + 24 * 60 * 60 * 1000));
        const symptomOnsetTime = typeof value.symptomOnsetTime === 'number'
            ? new Date(windowStart.getTime() + value.symptomOnsetTime * 60 * 60 * 1000)
            : undefined;

        const label = await Label.create({
            animalId: value.animalId,
            tenantId: req.user?.tenantId || req.user?.id || 'default',
            windowStart,
            windowEnd,
            outcome: normalizeOutcome(value.outcome),
            confirmedByVet: value.confirmedByVet,
            symptomOnsetTime,
            notes: value.notes?.trim() || '',
            labelledBy: resolveLabelledBy(req.user?.id),
            modelVersion: process.env.LABELLING_MODEL_VERSION || 'manual-labelling-v1',
        });

        return res.status(201).json({
            id: label.id,
            animalId: label.animalId,
            outcome: label.outcome,
            confirmedByVet: label.confirmedByVet,
            labelledAt: label.labelledAt,
        });
    } catch (error) {
        return res.status(500).json({ error: 'Error saving labelling diagnosis' });
    }
});

export default router;