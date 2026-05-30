import express from 'express';
import Joi from 'joi';
import Sheep from '../models/Sheep.js';
import authMiddleware, { authorize } from '../middleware/auth.js';

const router = express.Router();

// Validation schemas
const geofenceSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  description: Joi.string().optional().max(500),
  geometry: Joi.object({
    type: Joi.string().valid('Polygon').required(),
    coordinates: Joi.array().items(
      Joi.array().items(
        Joi.array().length(2).items(Joi.number())
      )
    ).required()
  }).required(),
  isActive: Joi.boolean().default(true),
  alertThreshold: Joi.number().min(1).default(1), // Number of violations before alert
  notificationChannels: Joi.array().items(
    Joi.string().valid('email', 'sms', 'push', 'websocket')
  ).default(['websocket'])
});

// In-memory storage for geofences (in production, use MongoDB)
let geofences = [];

// Get all geofences
router.get('/', async (req, res) => {
  try {
    const activeGeofences = geofences.filter(g => g.isActive);
    res.json({ geofences: activeGeofences });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching geofences' });
  }
});

// Get specific geofence
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const geofence = geofences.find(g => g.id === req.params.id && g.isActive);

    if (!geofence) {
      return res.status(404).json({ error: 'Geofence not found' });
    }

    res.json({ geofence });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching geofence' });
  }
});

// Create new geofence
router.post('/', authMiddleware, authorize('admin', 'operator'), async (req, res) => {
  try {
    await ensureGeofencesLoaded();

    const { error } = geofenceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const geofence = {
      id: Date.now().toString(),
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    geofences.push(geofence);

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('geofence:created', geofence);

    res.status(201).json({
      message: 'Geofence created successfully',
      geofence
    });
  } catch (error) {
    res.status(500).json({ error: 'Error creating geofence' });
  }
});

// Update geofence
router.put('/:id', authMiddleware, authorize('admin', 'operator'), async (req, res) => {
  try {
    const index = geofences.findIndex(g => g.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Geefence not found' });
    }

    const { error } = geofenceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    geofences[index] = {
      ...geofences[index],
      ...req.body,
      updatedAt: new Date()
    };

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('geofence:updated', geofences[index]);

    res.json({
      message: 'Geofence updated successfully',
      geofence: geofences[index]
    });
  } catch (error) {
    res.status(500).json({ error: 'Error updating geofence' });
  }
});

// Delete geofence
router.delete('/:id', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    const index = geofences.findIndex(g => g.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Geofence not found' });
    }

    const deletedGeofence = geofences[index];
    geofences.splice(index, 1);

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('geofence:deleted', { id: req.params.id });

    res.json({ message: 'Geofence deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting geofence' });
  }
});

// Helper function to check if point is in polygon
function isPointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

export default router;
