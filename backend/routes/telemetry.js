import express from 'express';
import Joi from 'joi';
import Sheep from '../models/Sheep.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
import { redisClient, isRedisConnected } from '../middleware/cache.js';

// Local fallback if Redis is unavailable
const localLastAlertState = new Map();

/**
 * Function to check if alert state has changed (prevents spam)
 * Uses Redis for persistence across server restarts
 */
async function hasAlertStateChanged(sheepId, alertType, isActive) {
  const key = `alert_state:${sheepId}:${alertType}`;
  
  try {
    let lastState;
    
    if (isRedisConnected) {
      const cached = await redisClient.get(key);
      lastState = cached === null ? null : cached === 'true';
    } else {
      lastState = localLastAlertState.get(key);
    }

    // Only consider state as changed if activity differs
    if (lastState === isActive) {
      return false;
    }

    // Update state
    if (isRedisConnected) {
      // Set with 24h expiration to avoid leaking memory for inactive devices
      await redisClient.set(key, isActive.toString(), { EX: 86400 });
    } else {
      localLastAlertState.set(key, isActive);
    }
    
    return true;
  } catch (err) {
    console.error('Error checking alert state in Redis:', err);
    return true; // Default to true to ensure alert is sent if error occurs
  }
}


// Validation schema for telemetry data
const telemetrySchema = Joi.object({
  deviceId: Joi.string().required(),
  sheepId: Joi.string().optional(),
  timestamp: Joi.date().default(Date.now),
  data: Joi.object({
    heartRate: Joi.number().min(0).max(300).optional(),
    temperature: Joi.number().min(-10).max(50).optional(),
    activity: Joi.number().min(0).max(100).optional(),
    batteryLevel: Joi.number().min(0).max(100).optional(),
    signalStrength: Joi.number().min(-120).max(0).optional(),
    location: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      accuracy: Joi.number().min(0).optional()
    }).optional()
  }).required()
});

// Store telemetry data (typically called by IoT devices)
router.post('/', async (req, res) => {
  try {
    const { error } = telemetrySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { deviceId, sheepId, timestamp, data } = req.body;

    // Find sheep by device ID or sheep ID
    let sheep;
    if (sheepId) {
      sheep = await Sheep.findOne({ sheepId, isActive: true });
    } else {
      sheep = await Sheep.findOne({ deviceId, isActive: true });
    }

    if (!sheep) {
      return res.status(404).json({ error: 'Sheep not found for this device' });
    }

    // Update sheep location if provided
    if (data.location) {
      sheep.location = {
        type: 'Point',
        coordinates: [data.location.longitude, data.location.latitude]
      };
      sheep.lastSeen = new Date();
      await sheep.save();
    }

    // Store telemetry data (in a real implementation, this would go to a telemetry collection)
    const telemetryData = {
      deviceId,
      sheepId: sheep.sheepId,
      timestamp: timestamp || new Date(),
      data,
      processed: false
    };

    // Emit real-time telemetry data
    const io = req.app.get('io');
    io.emit('telemetry:realtime', {
      sheepId: sheep.sheepId,
      deviceId,
      timestamp: telemetryData.timestamp,
      data
    });

    // Check for alerts
    const alerts = [];
    const resolvedSheepId = sheep.sheepId || sheep._id;

    // Heart rate check - only alert if state changed
    const hrAbnormal = data.heartRate && (data.heartRate < 60 || data.heartRate > 120);
    if (hrAbnormal && await hasAlertStateChanged(resolvedSheepId, 'heart_rate', true)) {
      alerts.push({
        type: 'heart_rate',
        severity: data.heartRate < 60 ? 'low' : 'high',
        value: data.heartRate,
        sheepId: resolvedSheepId,
        timestamp: new Date()
      });
    } else if (!hrAbnormal) {
      await hasAlertStateChanged(resolvedSheepId, 'heart_rate', false);
    }

    // Temperature check - only alert if state changed
    const tempAbnormal = data.temperature && (data.temperature < 38.5 || data.temperature > 40.5);
    if (tempAbnormal && await hasAlertStateChanged(resolvedSheepId, 'temperature', true)) {
      alerts.push({
        type: 'temperature',
        severity: data.temperature < 38.5 ? 'low' : 'high',
        value: data.temperature,
        sheepId: resolvedSheepId,
        timestamp: new Date()
      });
    } else if (!tempAbnormal) {
      await hasAlertStateChanged(resolvedSheepId, 'temperature', false);
    }

    // Battery check - only alert if state changed
    const batteryLow = data.batteryLevel && data.batteryLevel < 20;
    if (batteryLow && await hasAlertStateChanged(resolvedSheepId, 'battery', true)) {
      alerts.push({
        type: 'battery',
        severity: 'low',
        value: data.batteryLevel,
        deviceId,
        timestamp: new Date()
      });
    } else if (!batteryLow) {
      await hasAlertStateChanged(resolvedSheepId, 'battery', false);
    }

    // Only emit alerts if any new state changes
    if (alerts.length > 0) {
      console.log(`🔔 Emitting ${alerts.length} new alert(s) for ${resolvedSheepId}`);
      io.emit('alerts:new', alerts);
    }

    res.status(201).json({
      message: 'Telemetry data received',
      data: telemetryData,
      alerts: alerts.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Error processing telemetry data' });
  }
});

// Get latest telemetry for all sheep
router.get('/latest', authMiddleware, async (req, res) => {
  try {
    const sheep = await Sheep.find({ isActive: true })
      .select('sheepId breed age weight gender healthStatus location lastSeen deviceId')
      .sort({ lastSeen: -1 });

    // In a real implementation, you would fetch latest telemetry from a telemetry collection
    // For now, we'll return the sheep data with their last known locations
    const telemetryData = sheep.map(s => ({
      sheepId: s.sheepId,
      deviceId: s.deviceId,
      lastSeen: s.lastSeen,
      location: s.location,
      healthStatus: s.healthStatus
      // Latest telemetry would be added here from telemetry collection
    }));

    res.json({ telemetry: telemetryData });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching telemetry data' });
  }
});

// Get telemetry history for specific sheep
router.get('/:sheepId/history', authMiddleware, async (req, res) => {
  try {
    const { sheepId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    const sheep = await Sheep.findOne({ sheepId, isActive: true });
    if (!sheep) {
      return res.status(404).json({ error: 'Sheep not found' });
    }

    // In a real implementation, you would query the telemetry collection
    // For now, return a placeholder response
    const history = {
      sheepId,
      deviceId: sheep.deviceId,
      data: [], // Would contain telemetry records from database
      summary: {
        totalRecords: 0,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    };

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching telemetry history' });
  }
});

// Get telemetry statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const totalSheep = await Sheep.countDocuments({ isActive: true });
    const healthySheep = await Sheep.countDocuments({ isActive: true, healthStatus: 'healthy' });
    const sickSheep = await Sheep.countDocuments({ isActive: true, healthStatus: 'sick' });
    const injuredSheep = await Sheep.countDocuments({ isActive: true, healthStatus: 'injured' });

    const stats = {
      totalSheep,
      healthStatus: {
        healthy: healthySheep,
        sick: sickSheep,
        injured: injuredSheep,
        other: totalSheep - healthySheep - sickSheep - injuredSheep
      },
      // Additional telemetry stats would be calculated here
      lastUpdated: new Date()
    };

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching telemetry statistics' });
  }
});

export default router;
