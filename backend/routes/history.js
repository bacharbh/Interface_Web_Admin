import express from 'express';
import { getAllHistory } from '../services/firebaseService.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// GET /api/history — historique de tous les animaux depuis Firebase
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { from, to, sheepId, deviceId, limit = 1000 } = req.query;
    const collarId = sheepId || deviceId;

    const entries = await getAllHistory({ limit, collarId, from, to });

    const formatted = entries.map(entry => ({
      id: entry.key,
      sheepId: entry.collar_id,
      deviceId: entry.collar_id,
      collar_id: entry.collar_id,
      timestamp: entry.rx_time,
      rx_time: entry.rx_time,
      imu: entry.imu || null,
      lora: entry.lora || null,
      sensors: entry.sensors || null,
      ts: entry.ts || null,
      healthStatus: computeHealthStatus(entry.sensors),
      metadata: {
        temperature: entry.sensors?.temperature ?? null,
        movement_g: entry.sensors?.movement_g ?? null,
      }
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching history:', error.message);
    res.status(500).json({ error: 'Error fetching history data' });
  }
});

function computeHealthStatus(sensors) {
  if (!sensors) return 'healthy';
  const temp = sensors.temperature;
  if (temp == null) return 'healthy';
  if (temp > 40 || temp < 37) return 'sick';
  if (temp > 39.5 || temp < 38.0) return 'under_observation';
  return 'healthy';
}

export default router;
