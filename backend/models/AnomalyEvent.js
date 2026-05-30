import mongoose from 'mongoose';

const anomalyEventSchema = new mongoose.Schema({
  animalId: {
    type: String,
    required: true,
    index: true
  },
  farmId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  detectedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Score de probabilité calculé par TensorFlow.js (0 = Normal, 1 = Critique)
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  // Les features IoT qui ont causé l'anomalie
  features: {
    temperature: Number,
    movementRate: Number,
    heartRate: Number
  },
  // Évaluation post-hoc : l'éleveur confirme-t-il que l'animal était vraiment malade ? (Reinforcement Learning)
  truePositive: {
    type: Boolean,
    default: null
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date
  }
}, { timestamps: true });

// Index pour les requêtes analytiques
anomalyEventSchema.index({ farmId: 1, score: -1, timestamp: -1 });

export default mongoose.model('AnomalyEvent', anomalyEventSchema);
