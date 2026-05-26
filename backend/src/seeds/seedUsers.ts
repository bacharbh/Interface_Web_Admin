import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../../models/User.js';

dotenv.config();

const getConnectionUri = () => process.env.DB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-shepherd';
const force = process.argv.includes('--force');

const seed = async () => {
    await mongoose.connect(getConnectionUri());

    const existing = await User.countDocuments();
    if (existing > 0) {
        if (force) {
            await User.deleteMany({});
            console.log('✓ Cleared existing users');
        } else {
            console.log(`✓ Database already has ${existing} users — skipping seed`);
            await mongoose.disconnect();
            process.exit(0);
        }
    }

    const passwordHash = await bcrypt.hash('admin123', 10);
    const vetPasswordHash = await bcrypt.hash('vet123', 10);
    const farmerPasswordHash = await bcrypt.hash('farm123', 10);

    await User.insertMany([
        {
            username: 'administrateur',
            email: 'admin@smartshepherd.com',
            password: passwordHash,
            role: 'admin',
            isActive: true,
            lastLogin: new Date(),
        },
        {
            username: 'dr.martin',
            email: 'vet@smartshepherd.com',
            password: vetPasswordHash,
            role: 'operator',
            isActive: true,
            lastLogin: new Date(),
        },
        {
            username: 'jean.dupont',
            email: 'farmer@smartshepherd.com',
            password: farmerPasswordHash,
            role: 'viewer',
            isActive: true,
            lastLogin: new Date(),
        },
    ]);

    console.log('✓ Seeded 3 users successfully');
    await mongoose.disconnect();
    process.exit(0);
};

seed().catch(async (error) => {
    console.error('User seed failed:', error);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore disconnect errors
    }
    process.exit(1);
});
