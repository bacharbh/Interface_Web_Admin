/**
 * Smart Shepherd - Optimized Telemetry Data Model
 * Modèle optimisé pour les données de télémétrie IoT
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
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;    // latitude
        },
        message: 'Invalid GPS coordinates'
      }
    }
  },
  battery: {
    type: Number,
    min: 0,
    max: 100,
    default: 100,
    index: true // Index for battery level queries
  },
  temperature: {
    type: Number,
    min: 35,
    max: 42,
    validate: {
      validator: function(temp) {
        return temp >= 35 && temp <= 42;
      },
      message: 'Temperature must be between 35-42°C'
    }
  },
  heartRate: {
    type: Number,
    min: 40,
    max: 200,
    validate: {
      validator: function(hr) {
        return hr >= 40 && hr <= 200;
      },
      message: 'Heart rate must be between 40-200 BPM'
    }
  },
  activity: {
    type: String,
    enum: ['idle', 'resting', 'grazing', 'walking', 'running'],
    default: 'idle',
    index: true
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
    min: 0,
    max: 50 // Max 50 km/h for sheep
  },
  // Health indicators
  healthScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  // Anomaly detection flags
  anomalyFlags: [{
    type: String,
    enum: ['high_temp', 'low_temp', 'high_hr', 'low_hr', 'low_battery', 'geofence_breach', 'inactivity']
  }],
  // Data quality indicators
  dataQuality: {
    gpsAccuracy: Number,
    signalQuality: Number,
    batteryHealth: Number
  }
}, {
  timestamps: true,
  collection: 'telemetrydata',
  // Enable sharding for large datasets
  shardKey: { deviceId: 1, timestamp: 1 }
});

// OPTIMIZED INDEXES
// 1. Compound indexes for common queries
telemetryDataSchema.index({ deviceId: 1, timestamp: -1 });
telemetryDataSchema.index({ sheepId: 1, timestamp: -1 });
telemetryDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

// 2. Geospatial index for location queries
telemetryDataSchema.index({ location: '2dsphere' });

// 3. Health and battery monitoring indexes
telemetryDataSchema.index({ battery: 1, timestamp: -1 });
telemetryDataSchema.index({ healthScore: 1, timestamp: -1 });
telemetryDataSchema.index({ activity: 1, timestamp: -1 });

// 4. Anomaly detection index
telemetryDataSchema.index({ anomalyFlags: 1, timestamp: -1 });

// 5. Composite index for dashboard queries
telemetryDataSchema.index({ 
  deviceId: 1, 
  timestamp: -1, 
  battery: 1, 
  healthScore: 1 
});

// ENHANCED MIDDLEWARE
telemetryDataSchema.pre('save', function(next) {
  // Validate ranges
  if (this.heartRate && (this.heartRate < 40 || this.heartRate > 200)) {
    return next(new Error('Heart rate out of valid range (40-200 BPM)'));
  }
  
  if (this.temperature && (this.temperature < 35 || this.temperature > 42)) {
    return next(new Error('Temperature out of valid range (35-42°C)'));
  }

  // Auto-calculate health score
  this.healthScore = calculateHealthScore(this);

  // Auto-detect anomalies
  this.anomalyFlags = detectAnomalies(this);

  next();
});

// Health score calculation
function calculateHealthScore(data) {
  let score = 100;
  
  // Battery impact
  if (data.battery < 20) score -= 30;
  else if (data.battery < 50) score -= 10;
  
  // Temperature impact
  if (data.temperature < 36 || data.temperature > 41) score -= 25;
  else if (data.temperature < 37 || data.temperature > 40) score -= 10;
  
  // Heart rate impact
  if (data.heartRate < 50 || data.heartRate > 120) score -= 20;
  else if (data.heartRate < 60 || data.heartRate > 100) score -= 5;
  
  return Math.max(0, Math.min(100, score));
}

// Anomaly detection
function detectAnomalies(data) {
  const flags = [];
  
  if (data.temperature > 41) flags.push('high_temp');
  else if (data.temperature < 36) flags.push('low_temp');
  
  if (data.heartRate > 120) flags.push('high_hr');
  else if (data.heartRate < 50) flags.push('low_hr');
  
  if (data.battery < 20) flags.push('low_battery');
  
  if (data.activity === 'idle' && data.steps < 100) flags.push('inactivity');
  
  return flags;
}

// STATIC METHODS FOR OPTIMIZED QUERIES
telemetryDataSchema.statics.getLatestByDevice = async function(deviceId, limit = 1) {
  return this.find({ deviceId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean(); // Return plain JavaScript objects for better performance
};

telemetryDataSchema.statics.getHealthStatus = async function(deviceId, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { deviceId, timestamp: { $gte: since } } },
    { $group: {
      _id: '$deviceId',
      avgTemperature: { $avg: '$temperature' },
      avgHeartRate: { $avg: '$heartRate' },
      avgBattery: { $avg: '$battery' },
      minBattery: { $min: '$battery' },
      anomalyCount: { $sum: { $size: '$anomalyFlags' } },
      lastUpdate: { $max: '$timestamp' }
    }}
  ]);
};

telemetryDataSchema.statics.getGeofenceBreaches = async function(boundary, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    timestamp: { $gte: since },
    location: {
      $geoWithin: {
        $geometry: boundary
      }
    }
  }).lean();
};

telemetryDataSchema.statics.getBatteryAlerts = async function(threshold = 20) {
  return this.find({
    battery: { $lte: threshold },
    timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
  }).distinct('deviceId');
};

// VIRTUAL FIELDS
telemetryDataSchema.virtual('isHealthy').get(function() {
  return this.healthScore >= 70;
});

telemetryDataSchema.virtual('hasAnomalies').get(function() {
  return this.anomalyFlags && this.anomalyFlags.length > 0;
});

telemetryDataSchema.virtual('ageMinutes').get(function() {
  return Math.floor((Date.now() - this.timestamp.getTime()) / (1000 * 60));
});

// Ensure virtuals are included in JSON output
telemetryDataSchema.set('toJSON', { virtuals: true });
telemetryDataSchema.set('toObject', { virtuals: true });

export default mongoose.model('TelemetryData', telemetryDataSchema);
