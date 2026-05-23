import express from 'express';
import Joi from 'joi';
import AgendaEvent from '../models/AgendaEvent.js';
import authMiddleware, { authorize } from '../middleware/auth.js';

const router = express.Router();

const agendaEventSchema = Joi.object({
    title: Joi.string().trim().min(1).max(160).required(),
    type: Joi.string().valid('vaccine', 'checkup', 'treatment', 'other').required(),
    startAt: Joi.date().iso().required(),
    endAt: Joi.date().iso().greater(Joi.ref('startAt')).required(),
    animalIds: Joi.array().items(Joi.string().trim().min(1)).default([]),
    veterinarian: Joi.string().trim().max(120).allow('', null).default(''),
    notes: Joi.string().trim().max(2000).allow('', null).default(''),
    recurrence: Joi.string().valid('none', 'monthly', 'annual').default('none'),
    reminderMinutes: Joi.number().integer().min(0).default(60),
    status: Joi.string().valid('upcoming', 'done', 'cancelled').default('upcoming'),
});

const toDateRangeQuery = (from, to) => ({
    startAt: { $lt: new Date(to) },
    endAt: { $gt: new Date(from) },
    status: { $ne: 'cancelled' },
});

const detectConflicts = async (agendaEvent, excludeId = null) => {
    const vetTypes = ['vaccine', 'checkup', 'treatment'];
    const query = {
        _id: { $ne: excludeId },
        status: { $ne: 'cancelled' },
        startAt: { $lt: agendaEvent.endAt },
        endAt: { $gt: agendaEvent.startAt },
        type: { $in: vetTypes },
    };

    const conflicts = await AgendaEvent.find(query).sort({ startAt: 1 }).lean();
    return conflicts.map((event) => ({
        id: event._id.toString(),
        title: event.title,
        type: event.type,
        startAt: event.startAt,
        endAt: event.endAt,
    }));
};

const emitAgendaUpdate = (req, payload) => {
    const io = req.app.get('io');
    if (io) {
        io.emit('agenda:updated', payload);
    }
};

router.get('/events', authMiddleware, async (req, res) => {
    try {
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({ success: false, error: 'from et to sont requis' });
        }

        const events = await AgendaEvent.find(toDateRangeQuery(from, to)).sort({ startAt: 1 }).lean();

        res.json({
            success: true,
            data: events.map((event) => ({
                id: event._id.toString(),
                title: event.title,
                type: event.type,
                startAt: event.startAt,
                endAt: event.endAt,
                animalIds: event.animalIds || [],
                veterinarian: event.veterinarian || '',
                notes: event.notes || '',
                recurrence: event.recurrence || 'none',
                reminderMinutes: event.reminderMinutes ?? 60,
                status: event.status || 'upcoming',
                createdAt: event.createdAt,
                updatedAt: event.updatedAt,
                createdBy: event.createdBy,
                updatedBy: event.updatedBy,
            })),
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erreur lors du chargement des événements' });
    }
});

router.post('/events', authMiddleware, authorize('admin', 'operator'), async (req, res) => {
    try {
        const { error, value } = agendaEventSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) {
            return res.status(400).json({ success: false, error: error.details[0]?.message || 'Données invalides' });
        }

        const created = await AgendaEvent.create({
            ...value,
            createdBy: req.user?.id || null,
            updatedBy: req.user?.id || null,
        });

        const conflicts = await detectConflicts(created);
        const payload = created.toJSON();
        emitAgendaUpdate(req, { action: 'created', event: payload });

        res.status(201).json({ success: true, data: payload, conflicts });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erreur lors de la création de l\'événement' });
    }
});

router.put('/events/:id', authMiddleware, authorize('admin', 'operator'), async (req, res) => {
    try {
        const { error, value } = agendaEventSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) {
            return res.status(400).json({ success: false, error: error.details[0]?.message || 'Données invalides' });
        }

        const updated = await AgendaEvent.findByIdAndUpdate(
            req.params.id,
            { ...value, updatedBy: req.user?.id || null },
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({ success: false, error: 'Événement introuvable' });
        }

        const conflicts = await detectConflicts(updated, updated.id);
        const payload = updated.toJSON();
        emitAgendaUpdate(req, { action: 'updated', event: payload });

        res.json({ success: true, data: payload, conflicts });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour de l\'événement' });
    }
});

router.delete('/events/:id', authMiddleware, authorize('admin', 'operator'), async (req, res) => {
    try {
        const deleted = await AgendaEvent.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Événement introuvable' });
        }

        emitAgendaUpdate(req, { action: 'deleted', eventId: req.params.id });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erreur lors de la suppression de l\'événement' });
    }
});

export default router;