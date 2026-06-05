import express from 'express';
import { getAllAnimals, getAnimalByCollarId, getAnimalHistory, getAllHistory } from '../services/firebaseService.js';
import authMiddleware from '../middleware/auth.js';
import { redisClient, isRedisConnected } from '../middleware/cache.js';

const router = express.Router();

const localLastAlertState = new Map();

async function hasAlertStateChanged(collarId, alertType, isActive) {
  const key = `alert_state:${collarId}:${alertType}`;
  try {
    let lastState;
    if (isRedisConnected) {
      const cached = await redisClient.get(key);
      lastState = cached === null ? null : cached === 'true';
    } else {
      lastState = localLastAlertState.get(key);
    }
    if (lastState === isActive) return false;
    if (isRedisConnected) {
      await redisClient.set(key, isActive.toString(), { EX: 86400 });
    } else {
      localLastAlertState.set(key, isActive);
    }
    return true;
  } catch {
    return true;
  }
}

// POST /api/telemetry — reçoit des données IoT et émet des alertes
router.post('/', async (req, res) => {
  try {
    const { deviceId, sheepId, timestamp, data } = req.body;
    if (!deviceId || !data) {
      return res.status(400).json({ error: 'deviceId and data are required' });
    }

    const collarId = sheepId || deviceId;
    const io = req.app.get('io');

    io.emit('telemetry:realtime', { sheepId: collarId, deviceId, timestamp: timestamp || new Date(), data });

    const alerts = [];
    const tempAbnormal = data.temperature != null && (data.temperature < 38.5 || data.temperature > 40.5);
    if (tempAbnormal && await hasAlertStateChanged(collarId, 'temperature', true)) {
      alerts.push({ type: 'temperature', severity: data.temperature < 38.5 ? 'low' : 'high', value: data.temperature, sheepId: collarId, timestamp: new Date() });
    } else if (!tempAbnormal) {
      await hasAlertStateChanged(collarId, 'temperature', false);
    }

    const batteryLow = data.batteryLevel != null && data.batteryLevel < 20;
    if (batteryLow && await hasAlertStateChanged(collarId, 'battery', true)) {
      alerts.push({ type: 'battery', severity: 'low', value: data.batteryLevel, deviceId, timestamp: new Date() });
    } else if (!batteryLow) {
      await hasAlertStateChanged(collarId, 'battery', false);
    }

    if (alerts.length > 0) io.emit('alerts:new', alerts);

    res.status(201).json({ message: 'Telemetry data received', alerts: alerts.length });
  } catch (error) {
    console.error('Error processing telemetry:', error.message);
    res.status(500).json({ error: 'Error processing telemetry data' });
  }
});

// GET /api/telemetry/latest — dernière entrée par animal
router.get('/latest', authMiddleware, async (req, res) => {
  try {
    const animals = await getAllAnimals();
    const telemetryData = animals.map(a => ({
      sheepId: a.sheepId,
      deviceId: a.collar_id,
      lastSeen: a.lastSeen,
      temperature: a.temperature,
      movement_g: a.movement_g,
      lora: a.lora,
      healthStatus: a.healthStatus,
    }));
    res.json({ telemetry: telemetryData });
  } catch (error) {
    console.error('Error fetching latest telemetry:', error.message);
    res.status(500).json({ error: 'Error fetching telemetry data' });
  }
});

// GET /api/telemetry/history — historique global ou filtré
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { from, to, limit = 200, deviceId, sheepId } = req.query;
    const collarId = sheepId || deviceId;
    const data = await getAllHistory({ limit, collarId, from, to });
    res.json(data);
  } catch (error) {
    console.error('Error fetching telemetry history:', error.message);
    res.status(500).json({ error: 'Erreur telemetry history' });
  }
});

// GET /api/telemetry/stats — statistiques globales
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const animals = await getAllAnimals();
    const total = animals.length;
    const healthy = animals.filter(a => a.healthStatus === 'healthy').length;
    const sick = animals.filter(a => a.healthStatus === 'sick').length;
    const observation = animals.filter(a => a.healthStatus === 'under_observation').length;

    res.json({
      stats: {
        totalSheep: total,
        healthStatus: { healthy, sick, injured: 0, other: observation },
        lastUpdated: new Date(),
      }
    });
  } catch (error) {
    console.error('Error fetching telemetry stats:', error.message);
    res.status(500).json({ error: 'Error fetching telemetry statistics' });
  }
});

// GET /api/telemetry/:collarId/history — historique d'un animal
router.get('/:sheepId/history', authMiddleware, async (req, res) => {
  try {
    const { sheepId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    const animal = await getAnimalByCollarId(sheepId);
    if (!animal) {
      return res.status(404).json({ error: 'Sheep not found' });
    }

    const entries = await getAnimalHistory(sheepId, { limit, from: startDate, to: endDate });

    res.json({
      sheepId,
      deviceId: sheepId,
      data: entries,
      summary: {
        totalRecords: entries.length,
        dateRange: { start: startDate, end: endDate }
      }
    });
  } catch (error) {
    console.error('Error fetching sheep history:', error.message);
    res.status(500).json({ error: 'Error fetching telemetry history' });
  }
});

export default router;
