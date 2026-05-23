/**
 * Smart Shepherd - Create AI Test Data
 * Script pour générer des données de test pour le module IA
 */

const mongoose = require('mongoose');

// Load models dynamically since they're ES modules
async function loadModels() {
  const TelemetryDataModule = await import('../backend/models/TelemetryData.js');
  const SheepModule = await import('../backend/models/Sheep.js');
  return {
    TelemetryData: TelemetryDataModule.default,
    Sheep: SheepModule.default
  };
}

async function createAITestData() {
  try {
    // Load models
    const { TelemetryData, Sheep } = await loadModels();
    
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/smart-shepherd');
    console.log('Connected to MongoDB');
    
    // Créer animaux de test
    const testSheep = [
      {
        sheepId: 'SHEEP_AI_001',
        breed: 'Merino',
        age: 3,
        weight: 65,
        gender: 'female',
        healthStatus: 'healthy',
        deviceId: 'DEVICE_AI_001',
        isActive: true
      },
      {
        sheepId: 'SHEEP_AI_002', 
        breed: 'Suffolk',
        age: 2,
        weight: 70,
        gender: 'male',
        healthStatus: 'sick',
        deviceId: 'DEVICE_AI_002',
        isActive: true
      },
      {
        sheepId: 'SHEEP_AI_003',
        breed: 'Dorper',
        age: 4,
        weight: 75,
        gender: 'female',
        healthStatus: 'healthy',
        deviceId: 'DEVICE_AI_003',
        isActive: true
      }
    ];
    
    // Nettoyer les animaux existants
    await Sheep.deleteMany({ sheepId: /^SHEEP_AI_/ });
    await TelemetryData.deleteMany({ sheepId: /^SHEEP_AI_/ });
    
    // Insérer les animaux
    await Sheep.insertMany(testSheep);
    console.log('Created 3 test sheep');
    
    // Créer données télémétrie de test (30 jours)
    const telemetryData = [];
    const now = new Date();
    
    for (let day = 0; day < 30; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const timestamp = new Date(now.getTime() - (day * 24 * 60 * 60 * 1000) - (hour * 60 * 60 * 1000));
        
        // SHEEP_AI_001 - Données normales
        telemetryData.push({
          deviceId: 'DEVICE_AI_001',
          sheepId: 'SHEEP_AI_001',
          timestamp,
          location: { lat: 33.885 + Math.random() * 0.01, lng: -5.54 + Math.random() * 0.01, accuracy: 5 },
          battery: Math.max(50, 100 - (day * 1.5) + Math.random() * 5),
          temperature: 38.5 + Math.random() * 1.0,
          heartRate: 70 + Math.random() * 20,
          activity: hour < 6 || hour > 20 ? 'resting' : (hour < 10 || hour > 17 ? 'grazing' : 'walking'),
          signalStrength: -50 + Math.random() * 20,
          steps: Math.floor(Math.random() * 1000),
          heading: Math.random() * 360,
          speed: Math.random() * 5
        });
        
        // SHEEP_AI_002 - Données avec anomalies
        const isAnomaly = Math.random() < 0.08; // 8% d'anomalies
        telemetryData.push({
          deviceId: 'DEVICE_AI_002',
          sheepId: 'SHEEP_AI_002',
          timestamp,
          location: { lat: 33.886 + Math.random() * 0.01, lng: -5.55 + Math.random() * 0.01, accuracy: 5 },
          battery: Math.max(30, 80 - (day * 2.0) + Math.random() * 10),
          temperature: isAnomaly ? 41.0 + Math.random() * 1.0 : 38.8 + Math.random() * 1.2,
          heartRate: isAnomaly ? 130 + Math.random() * 20 : 75 + Math.random() * 25,
          activity: isAnomaly ? 'idle' : (hour < 6 || hour > 20 ? 'resting' : 'grazing'),
          signalStrength: -60 + Math.random() * 25,
          steps: Math.floor(Math.random() * 800),
          heading: Math.random() * 360,
          speed: Math.random() * 4
        });
        
        // SHEEP_AI_003 - Données variables
        const dayPhase = Math.floor(hour / 6); // 0: nuit, 1: matin, 2: après-midi, 3: soir
        telemetryData.push({
          deviceId: 'DEVICE_AI_003',
          sheepId: 'SHEEP_AI_003',
          timestamp,
          location: { lat: 33.887 + Math.random() * 0.01, lng: -5.56 + Math.random() * 0.01, accuracy: 5 },
          battery: Math.max(40, 90 - (day * 1.8) + Math.random() * 8),
          temperature: 38.2 + Math.random() * 1.5 + (dayPhase * 0.2),
          heartRate: 65 + Math.random() * 30 + (dayPhase * 5),
          activity: dayPhase === 0 ? 'resting' : (dayPhase === 1 ? 'grazing' : (dayPhase === 2 ? 'walking' : 'resting')),
          signalStrength: -55 + Math.random() * 22,
          steps: Math.floor(Math.random() * 1200),
          heading: Math.random() * 360,
          speed: Math.random() * 6
        });
      }
    }
    
    // Insérer les données par lots pour éviter les timeouts
    const batchSize = 1000;
    for (let i = 0; i < telemetryData.length; i += batchSize) {
      const batch = telemetryData.slice(i, i + batchSize);
      await TelemetryData.insertMany(batch);
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(telemetryData.length / batchSize)}`);
    }
    
    console.log(`Created ${telemetryData.length} telemetry records`);
    console.log('Test data creation completed successfully');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error creating test data:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createAITestData();
