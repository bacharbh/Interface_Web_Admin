import express from 'express';
import Joi from 'joi';
import authMiddleware, { authorize } from '../middleware/auth.js';

const router = express.Router();

// Stockage en mémoire (remplace AgendaEvent MongoDB)
let agendaEvents = [];

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

const emitAgendaUpdate = (req, payload) => {
  const io = req.app.get('io');
  if (io) io.emit('agenda:updated', payload);
};

router.get('/events', authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ success: false, error: 'from et to sont requis' });
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const events = agendaEvents.filter(e =>
      e.status !== 'cancelled' &&
      new Date(e.startAt) < toDate &&
      new Date(e.endAt) > fromDate
    );
    res.json({ success: true, data: events });
  } catch {
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des événements' });
  }
});

router.post('/events', authMiddleware, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { error, value } = agendaEventSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0]?.message || 'Données invalides' });
    }
    const event = {
      id: `event-${Date.now()}`,
      _id: `event-${Date.now()}`,
      ...value,
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    agendaEvents.push(event);
    emitAgendaUpdate(req, { action: 'created', event });
    res.status(201).json({ success: true, data: event, conflicts: [] });
  } catch {
    res.status(500).json({ success: false, error: "Erreur lors de la création de l'événement" });
  }
});

router.put('/events/:id', authMiddleware, authorize('admin', 'operator'), async (req, res) => {
  try {
    const { error, value } = agendaEventSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0]?.message || 'Données invalides' });
    }
    const idx = agendaEvents.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    agendaEvents[idx] = { ...agendaEvents[idx], ...value, updatedBy: req.user?.id || null, updatedAt: new Date().toISOString() };
    emitAgendaUpdate(req, { action: 'updated', event: agendaEvents[idx] });
    res.json({ success: true, data: agendaEvents[idx], conflicts: [] });
  } catch {
    res.status(500).json({ success: false, error: "Erreur lors de la mise à jour de l'événement" });
  }
});

router.delete('/events/:id', authMiddleware, authorize('admin', 'operator'), async (req, res) => {
  try {
    const idx = agendaEvents.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    agendaEvents.splice(idx, 1);
    emitAgendaUpdate(req, { action: 'deleted', eventId: req.params.id });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: "Erreur lors de la suppression de l'événement" });
  }
});

export default router;
