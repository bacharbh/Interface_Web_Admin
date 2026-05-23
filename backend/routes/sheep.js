import express from 'express';
import Joi from 'joi';
import Sheep from '../models/Sheep.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Validation schemas
const sheepSchema = Joi.object({
  sheepId: Joi.string().required(),
  breed: Joi.string().valid('Merino', 'Suffolk', 'Dorper', 'Hampshire', 'Rambouillet', 'Other').required(),
  age: Joi.number().min(0).max(20).required(),
  weight: Joi.number().min(0).required(),
  gender: Joi.string().valid('male', 'female').required(),
  healthStatus: Joi.string().valid('healthy', 'sick', 'injured', 'quarantine', 'under_observation').default('healthy'),
  deviceId: Joi.string().optional(),
  location: Joi.object({
    type: Joi.string().valid('Point').default('Point'),
    coordinates: Joi.array().items(Joi.number()).length(2).default([0, 0])
  }).optional()
});

// Get all sheep with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { isActive: true };
    
    if (req.query.healthStatus) {
      filter.healthStatus = req.query.healthStatus;
    }
    
    if (req.query.breed) {
      filter.breed = req.query.breed;
    }
    
    if (req.query.gender) {
      filter.gender = req.query.gender;
    }

    const sheep = await Sheep.find(filter)
      .sort({ lastSeen: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Sheep.countDocuments(filter);

    res.json({
      sheep,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching sheep data' });
  }
});

// Get sheep by ID
router.get('/:id', async (req, res) => {
  try {
    const sheep = await Sheep.findOne({ sheepId: req.params.id, isActive: true });
    
    if (!sheep) {
      return res.status(404).json({ error: 'Sheep not found' });
    }

    res.json({ sheep });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching sheep data' });
  }
});

// Create new sheep
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { error } = sheepSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if sheep ID already exists
    const existingSheep = await Sheep.findOne({ sheepId: req.body.sheepId });
    if (existingSheep) {
      return res.status(400).json({ error: 'Sheep ID already exists' });
    }

    // Check if device ID already exists (if provided)
    if (req.body.deviceId) {
      const existingDevice = await Sheep.findOne({ deviceId: req.body.deviceId });
      if (existingDevice) {
        return res.status(400).json({ error: 'Device ID already assigned to another sheep' });
      }
    }

    const sheep = new Sheep(req.body);
    await sheep.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('sheep:added', sheep);

    res.status(201).json({
      message: 'Sheep registered successfully',
      sheep
    });
  } catch (error) {
    res.status(500).json({ error: 'Error registering sheep' });
  }
});

// Update sheep information
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = sheepSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const sheep = await Sheep.findOneAndUpdate(
      { sheepId: req.params.id, isActive: true },
      req.body,
      { new: true, runValidators: true }
    );

    if (!sheep) {
      return res.status(404).json({ error: 'Sheep not found' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('sheep:updated', sheep);

    res.json({
      message: 'Sheep updated successfully',
      sheep
    });
  } catch (error) {
    res.status(500).json({ error: 'Error updating sheep' });
  }
});

// Update sheep location
router.patch('/:id/location', async (req, res) => {
  try {
    const { coordinates } = req.body;
    
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ error: 'Invalid coordinates format' });
    }

    const sheep = await Sheep.findOneAndUpdate(
      { sheepId: req.params.id, isActive: true },
      { 
        location: { type: 'Point', coordinates },
        lastSeen: new Date()
      },
      { new: true }
    );

    if (!sheep) {
      return res.status(404).json({ error: 'Sheep not found' });
    }

    // Emit real-time location update
    const io = req.app.get('io');
    io.emit('sheep:location', {
      sheepId: sheep.sheepId,
      location: sheep.location,
      lastSeen: sheep.lastSeen
    });

    res.json({
      message: 'Location updated successfully',
      sheep
    });
  } catch (error) {
    res.status(500).json({ error: 'Error updating sheep location' });
  }
});

// Add medical record
router.post('/:id/medical', authMiddleware, async (req, res) => {
  try {
    const { condition, treatment, veterinarian, notes } = req.body;
    
    if (!condition || !treatment) {
      return res.status(400).json({ error: 'Condition and treatment are required' });
    }

    const sheep = await Sheep.findOne({ sheepId: req.params.id, isActive: true });
    
    if (!sheep) {
      return res.status(404).json({ error: 'Sheep not found' });
    }

    sheep.medicalHistory.push({
      condition,
      treatment,
      veterinarian,
      notes,
      date: new Date()
    });

    await sheep.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('sheep:medical', {
      sheepId: sheep.sheepId,
      medicalRecord: sheep.medicalHistory[sheep.medicalHistory.length - 1]
    });

    res.json({
      message: 'Medical record added successfully',
      medicalRecord: sheep.medicalHistory[sheep.medicalHistory.length - 1]
    });
  } catch (error) {
    res.status(500).json({ error: 'Error adding medical record' });
  }
});

// Delete sheep (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const sheep = await Sheep.findOneAndUpdate(
      { sheepId: req.params.id, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!sheep) {
      return res.status(404).json({ error: 'Sheep not found' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('sheep:deleted', { sheepId: sheep.sheepId });

    res.json({ message: 'Sheep deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting sheep' });
  }
});

export default router;
