import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Sheep from '../../models/Sheep.js';

dotenv.config();

const getConnectionUri = () => process.env.DB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-shepherd';
const force = process.argv.includes('--force');

const ALERT_TYPES = ['low_battery', 'out_of_zone', 'collar_offline', 'health_warning'];

const seed = async () => {
    await mongoose.connect(getConnectionUri());

    const db = mongoose.connection.db;
    const collection = db.collection('alerts');

    const existing = await collection.countDocuments();
    if (existing > 0) {
        if (force) {
            await collection.deleteMany({});
            console.log('✓ Cleared existing alerts');
        } else {
            console.log(`✓ Database already has ${existing} alerts — skipping seed`);
            await mongoose.disconnect();
            process.exit(0);
        }
    }

    const animals = await Sheep.find().limit(10).lean();
    if (animals.length === 0) {
        console.log('⚠ No animals found — skipping alert seed');
        await mongoose.disconnect();
        process.exit(0);
    }

    const alerts = animals.map((animal, index) => ({
        animalId: animal._id,
        animalName: animal.name,
        collarId: animal.collarId || animal.sheepId,
        type: ALERT_TYPES[index % ALERT_TYPES.length],
        severity: index % 3 === 0 ? 'critical' : 'warning',
        message: `Alerte détectée sur ${animal.name}`,
        read: false,
        isRead: false,
        readAt: null,
        readBy: null,
        createdAt: new Date(Date.now() - index * 3600000),
        updatedAt: new Date(Date.now() - index * 3600000),
    }));

    await collection.insertMany(alerts);
    console.log(`✓ Seeded ${alerts.length} alerts successfully`);
    await mongoose.disconnect();
    process.exit(0);
};

seed().catch(async (error) => {
    console.error('Alert seed failed:', error);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore disconnect errors
    }
    process.exit(1);
});
