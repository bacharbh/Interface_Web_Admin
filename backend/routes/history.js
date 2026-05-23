import express from 'express';
import Sheep from '../models/Sheep.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Get animal history data (used by Analytics page)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { from, to, sheepId, deviceId } = req.query;

        let filter = { isActive: true };

        if (sheepId) {
            filter.sheepId = sheepId;
        }

        if (deviceId) {
            filter.deviceId = deviceId;
        }

        // Parse date filters
        let dateFilter = {};
        if (from) {
            dateFilter.$gte = new Date(from);
        }
        if (to) {
            dateFilter.$lte = new Date(to);
        }

        if (Object.keys(dateFilter).length > 0) {
            filter.lastSeen = dateFilter;
        }

        const history = await Sheep.find(filter)
            .sort({ lastSeen: -1 })
            .limit(1000)
            .select('sheepId deviceId location lastSeen healthStatus breed age weight temperature battery');

        // Transform to match expected format
        const formattedHistory = history.map(doc => ({
            id: doc._id,
            sheepId: doc.sheepId,
            deviceId: doc.deviceId,
            location: doc.location,
            timestamp: doc.lastSeen,
            healthStatus: doc.healthStatus,
            metadata: {
                breed: doc.breed,
                age: doc.age,
                weight: doc.weight,
                temperature: doc.temperature,
                battery: doc.battery
            }
        }));

        res.json(formattedHistory);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Error fetching history data' });
    }
});

export default router;
