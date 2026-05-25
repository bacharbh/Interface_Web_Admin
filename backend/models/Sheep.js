/**
 * Smart Shepherd - Sheep Model
 * Modèle pour les données des moutons
 */

import mongoose from 'mongoose';

const sheepSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  sheepId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  collarId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  race: {
    type: String,
    trim: true
  },
  breed: {
    type: String,
    required: true,
    enum: ['Merino', 'Suffolk', 'Dorper', 'Hampshire', 'Rambouillet', 'Other']
  },
  status: {
    type: String,
    enum: ['healthy', 'warning', 'critical']
  },
  battery: {
    type: Number,
    min: 0,
    max: 100
  },
  temperature: {
    type: Number
  },
  age: {
    type: Number,
    required: true,
    min: 0,
    max: 20
  },
  weight: {
    type: Number,
    required: true,
    min: 0
  },
  lat: {
    type: Number
  },
  lng: {
    type: Number
  },
  gender: {
    type: String,
    required: true,
    enum: ['male', 'female']
  },
  healthStatus: {
    type: String,
    enum: ['healthy', 'sick', 'injured', 'quarantine', 'under_observation'],
    default: 'healthy'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  active: {
    type: Boolean,
    default: true
  },
  deviceId: {
    type: String,
    unique: true,
    sparse: true
  },
  medicalHistory: [{
    date: { type: Date, default: Date.now },
    condition: String,
    treatment: String,
    veterinarian: String,
    notes: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

sheepSchema.index({ location: '2dsphere' });
sheepSchema.index({ sheepId: 1 });
sheepSchema.index({ deviceId: 1 });

sheepSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Sheep', sheepSchema);
