import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-shepherd';

/**
 * Script de migration pour créer les index critiques.
 * Lancer avec: node migration_indexes.js
 */
async function runMigration() {
  console.log('🔌 Connexion à MongoDB:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('✅ Connecté avec succès.\n');

  try {
    // ---------------------------------------------------------
    // 1. Collection: TelemetryData
    // ---------------------------------------------------------
    console.log('⚙️ Création des index pour [telemetrydatas]...');
    const telemetryCollection = db.collection('telemetrydatas');
    
    // Index composé pour les requêtes de filtrage par device chronologiques
    await telemetryCollection.createIndex(
      { deviceId: 1, timestamp: -1 },
      { name: 'idx_device_timestamp', background: true }
    );
    
    // Index TTL pour purger automatiquement les données vieilles de 30 jours
    await telemetryCollection.createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 30 * 24 * 60 * 60, name: 'idx_ttl_30d', background: true }
    );
    console.log('   ✅ Index TelemetryData créés.');

    // ---------------------------------------------------------
    // 2. Collection: Sheep
    // ---------------------------------------------------------
    console.log('\n⚙️ Création des index pour [sheep]...');
    const sheepCollection = db.collection('sheep');
    
    // Index composé pour lister le troupeau par ferme et état de santé
    await sheepCollection.createIndex(
      { farmId: 1, status: 1 },
      { name: 'idx_farm_status', background: true }
    );
    
    // Index géospatial pour les requêtes $near ou $geoWithin
    await sheepCollection.createIndex(
      { location: '2dsphere' },
      { name: 'idx_location_2dsphere', background: true }
    );
    console.log('   ✅ Index Sheep créés.');

    // ---------------------------------------------------------
    // 3. Collection: Alert
    // ---------------------------------------------------------
    console.log('\n⚙️ Création des index pour [alerts]...');
    // Créera automatiquement la collection si elle n'existe pas
    const alertCollection = db.collection('alerts');
    
    // Index pour l'historique d'un animal filtré par gravité
    await alertCollection.createIndex(
      { animalId: 1, severity: 1, createdAt: -1 },
      { name: 'idx_animal_severity_date', background: true }
    );
    
    // Index pour le flux d'alertes non-lues
    await alertCollection.createIndex(
      { read: 1, createdAt: -1 },
      { name: 'idx_read_date', background: true }
    );
    console.log('   ✅ Index Alert créés.');

    // ---------------------------------------------------------
    // 4. Exécution de explain() pour valider les Query Plans (AFTER)
    // ---------------------------------------------------------
    console.log('\n🔍 Validation des Query Plans (AFTER) :');
    
    // Requête 1: Dernières télémétries d'un appareil
    const explainTelemetry = await telemetryCollection.find({ deviceId: 'DEV-123' }).sort({ timestamp: -1 }).limit(10).explain("executionStats");
    console.log(`   - Télémétrie: Stratégie utilisée -> ${explainTelemetry.queryPlanner.winningPlan.stage} (Index: ${explainTelemetry.queryPlanner.winningPlan.inputStage?.indexName || 'N/A'})`);

    // Requête 2: Animaux malades d'une ferme
    const explainSheep = await sheepCollection.find({ farmId: 'FARM-1', status: 'SICK' }).explain("executionStats");
    console.log(`   - Troupeau: Stratégie utilisée -> ${explainSheep.queryPlanner.winningPlan.stage} (Index: ${explainSheep.queryPlanner.winningPlan.inputStage?.indexName || 'N/A'})`);

    // Requête 3: 10 dernières alertes non lues
    const explainAlerts = await alertCollection.find({ read: false }).sort({ createdAt: -1 }).limit(10).explain("executionStats");
    console.log(`   - Alertes: Stratégie utilisée -> ${explainAlerts.queryPlanner.winningPlan.stage} (Index: ${explainAlerts.queryPlanner.winningPlan.inputStage?.indexName || 'N/A'})`);

    console.log('\n🎉 Migration des index terminée avec succès !');
  } catch (error) {
    console.error('❌ Erreur durant la migration:', error);
  } finally {
    await mongoose.disconnect();
  }
}

runMigration();
