
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const getConnectionUri = () => 
  process.env.DB_URL || 
  process.env.MONGODB_URI || 
  'mongodb://localhost:27017/smart-shepherd';

const resetDatabase = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(getConnectionUri());
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    console.log('📋 Fetching all collections...');
    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
      console.log('ℹ️ No collections found to drop');
    } else {
      console.log(`🗑️ Dropping ${collections.length} collections...`);
      for (const collection of collections) {
        try {
          await db.dropCollection(collection.name);
          console.log(`  ✓ Dropped "${collection.name}"`);
        } catch (err) {
          console.warn(`  ⚠️ Could not drop "${collection.name}":`, err.message);
        }
      }
      console.log('✅ All collections dropped');
    }

    console.log('🔄 Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('✅ Database reset complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
};

resetDatabase();
