import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Sheep from '../../models/Sheep.js';

dotenv.config();

const RACES = ['Merinos', 'Lacaune', 'Rambouillet', 'Suffolk', 'Jacob', 'Texel', 'Dorper'];
const BREEDS = ['Merino', 'Rambouillet', 'Suffolk', 'Dorper', 'Hampshire', 'Other'];
const TYPES = ['Bélier', 'Brebis', 'Agneau', 'Mouton'];

const getConnectionUri = () => process.env.DB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-shepherd';

const generateAnimals = (count: number) =>
    Array.from({ length: count }, (_, index) => {
        const number = index + 1;
        const type = TYPES[index % TYPES.length];
        const race = RACES[index % RACES.length];
        const breed = BREEDS[index % BREEDS.length];
        const healthStatus = number % 10 === 0 ? 'sick' : number % 4 === 0 ? 'under_observation' : 'healthy';
        const gender = type === 'Bélier' || type === 'Mouton' ? 'male' : 'female';

        return {
            name: `${type} #${number}`,
            sheepId: `C${String(number).padStart(3, '0')}`,
            collarId: `C${String(number).padStart(3, '0')}`,
            race,
            breed,
            status: healthStatus === 'healthy' ? 'healthy' : healthStatus === 'under_observation' ? 'warning' : 'critical',
            healthStatus,
            battery: Math.floor(Math.random() * 60) + 40,
            temperature: Number((38 + Math.random() * 2).toFixed(1)),
            weight: Math.floor(Math.random() * 40) + 40,
            age: Math.floor(Math.random() * 8) + 1,
            lat: 36.8 + (Math.random() - 0.5) * 0.1,
            lng: 10.18 + (Math.random() - 0.5) * 0.1,
            location: {
                type: 'Point',
                coordinates: [10.18 + (Math.random() - 0.5) * 0.1, 36.8 + (Math.random() - 0.5) * 0.1],
            },
            lastSeen: new Date(),
            lastUpdate: new Date(),
            active: true,
            isActive: true,
            gender,
            deviceId: `DEV-${String(number).padStart(3, '0')}`,
        };
    });

const seed = async () => {
    await mongoose.connect(getConnectionUri());

    const existing = await Sheep.countDocuments();
    if (existing > 0) {
        console.log(`✓ Database already has ${existing} animals — skipping seed`);
        await mongoose.disconnect();
        process.exit(0);
    }

    const animals = generateAnimals(200);
    await Sheep.insertMany(animals);
    console.log('✓ Seeded 200 animals successfully');
    await mongoose.disconnect();
    process.exit(0);
};

seed().catch(async (error) => {
    console.error('Seed failed:', error);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore disconnect errors
    }
    process.exit(1);
});