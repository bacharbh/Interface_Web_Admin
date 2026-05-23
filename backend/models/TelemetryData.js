/**
 * Smart Shepherd - Telemetry Data Model
 * Modèle pour les données de télémétrie IoT
 */

import mongoose from 'mongoose';

const telemetryDataSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    ref: 'Device',
    index: true
  },
  sheepId: {
    type: String,
    required: true,
    ref: 'Sheep',
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  location: {
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    accuracy: {
      type: Number,
      min: 0
    }
  },
  battery: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  temperature: {
    type: Number,
    min: 35,
    max: 42
  },
  heartRate: {
    type: Number,
    min: 40,
    max: 200
  },
  activity: {
    type: String,
    enum: ['idle', 'resting', 'grazing', 'walking', 'running'],
    default: 'idle'
  },
  signalStrength: {
    type: Number,
    min: -120,
    max: 0
  },
  steps: {
    type: Number,
    min: 0,
    default: 0
  },
  heading: {
    type: Number,
    min: 0,
    max: 360
  },
  speed: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true,
  collection: 'telemetrydata'
});

// Index composés pour les requêtes fréquentes
telemetryDataSchema.index({ sheepId: 1, timestamp: -1 });
telemetryDataSchema.index({ deviceId: 1, timestamp: -1 });
telemetryDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 jours

// Middleware pour la validation
telemetryDataSchema.pre('save', function(next) {
  // Valider les plages de valeurs normales
  if (this.heartRate && (this.heartRate < 40 || this.heartRate > 200)) {
    return next(new Error('Fréquence cardiaque hors plage valide (40-200 BPM)'));
  }
  
  if (this.temperature && (this.temperature < 35 || this.temperature > 42)) {
    return next(new Error('Température hors plage valide (35-42°C)'));
  }
  
  next();
});

export default mongoose.model('TelemetryData', telemetryDataSchema);
