import express from 'express';
import { getAllAnimals } from '../services/firebaseService.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Alertes calculées dynamiquement depuis les données Firebase
async function computeAlertsFromFirebase() {
  const animals = await getAllAnimals();
  const alerts = [];

  for (const animal of animals) {
    const temp = animal.temperature;
    const collarId = animal.collar_id;
    const rxTime = animal.lastSeen || new Date().toISOString();

    if (temp != null) {
      if (temp > 40) {
        alerts.push({
          _id: `${collarId}_temp_high`,
          type: 'temperature',
          severity: 'critical',
          message: `Température critique (${temp}°C) — ${collarId}`,
          sheepId: collarId,
          value: temp,
          read: false,
          createdAt: rxTime,
        });
      } else if (temp > 39.5) {
        alerts.push({
          _id: `${collarId}_temp_warn`,
          type: 'temperature',
          severity: 'warning',
          message: `Température élevée (${temp}°C) — ${collarId}`,
          sheepId: collarId,
          value: temp,
          read: false,
          createdAt: rxTime,
        });
      } else if (temp < 37) {
        alerts.push({
          _id: `${collarId}_temp_low`,
          type: 'temperature',
          severity: 'critical',
          message: `Température basse (${temp}°C) — ${collarId}`,
          sheepId: collarId,
          value: temp,
          read: false,
          createdAt: rxTime,
        });
      }
    }

    if (animal.lora?.rssi != null && animal.lora.rssi < -110) {
      alerts.push({
        _id: `${collarId}_rssi`,
        type: 'signal',
        severity: 'warning',
        message: `Signal faible (RSSI ${animal.lora.rssi} dBm) — ${collarId}`,
        sheepId: collarId,
        value: animal.lora.rssi,
        read: false,
        createdAt: rxTime,
      });
    }
  }

  return alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Mémoire locale pour marquer les alertes comme lues
const readAlerts = new Set();

// GET /api/alerts — alertes paginées
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, severity, read } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    let alerts = await computeAlertsFromFirebase();

    // Appliquer l'état lu/non-lu depuis la mémoire locale
    alerts = alerts.map(a => ({ ...a, read: readAlerts.has(a._id) }));

    if (severity) alerts = alerts.filter(a => a.severity === severity);
    if (read !== undefined) alerts = alerts.filter(a => a.read === (read === 'true'));

    const total = alerts.length;
    const paged = alerts.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      alerts: paged,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error.message);
    res.status(500).json({ error: 'Server error fetching alerts' });
  }
});

// PATCH /api/alerts/:id/read — marquer une alerte comme lue
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    readAlerts.add(req.params.id);

    const io = req.app.get('io');
    if (io) io.emit('notification:read', { id: req.params.id });

    res.json({ success: true, alert: { _id: req.params.id, read: true } });
  } catch (error) {
    console.error('Error marking alert as read:', error.message);
    res.status(500).json({ error: 'Server error updating alert' });
  }
});

export default router;
