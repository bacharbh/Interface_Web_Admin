import express from 'express';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// GET /api/alerts - Paginated alerts with MongoDB Cursor
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, severity, read } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    // Build query filter
    const filter = {};
    if (severity) filter.severity = severity;
    if (read !== undefined) filter.read = read === 'true';

    const db = mongoose.connection.db;
    const collection = db.collection('alerts');

    // Cursor based fetching
    const cursor = collection.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const alerts = await cursor.toArray();
    const total = await collection.countDocuments(filter);

    res.json({
      alerts,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Server error fetching alerts' });
  }
});

// PATCH /api/alerts/:id/read - Mark alert as read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const result = await db.collection('alerts').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.params.id) },
      { $set: { read: true, readAt: new Date(), readBy: req.user?.username } },
      { returnDocument: 'after' }
    );

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('notification:read', { id: req.params.id });
    }

    res.json({ success: true, alert: result.value });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({ error: 'Server error updating alert' });
  }
});

export default router;
