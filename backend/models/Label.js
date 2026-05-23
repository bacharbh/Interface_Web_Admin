import mongoose from 'mongoose';

const labelSchema = new mongoose.Schema({
  animalId: { type: String, required: true, index: true },
  tenantId: { type: String, required: true },
  windowStart: { type: Date, required: true },
  windowEnd: { type: Date, required: true },
  
  outcome: { 
    type: String, 
    enum: ['Healthy', 'Fever', 'Respiratory illness', 'Digestive disorder', 'Injury', 'Unknown'],
    required: true 
  },
  
  confirmedByVet: { type: Boolean, default: false },
  symptomOnsetTime: { type: Date },
  notes: { type: String },
  
  labelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  labelledAt: { type: Date, default: Date.now },
  
  // Track which model was active during flagging
  modelVersion: { type: String, required: true },
  
  // Active Learning metadata
  isUsedInTraining: { type: Boolean, default: false },
  mlflowRunId: { type: String }
}, {
  timestamps: true
});

// Composite index for fast telemetry joins
labelSchema.index({ animalId: 1, windowStart: 1 });

const Label = mongoose.model('Label', labelSchema);

export default Label;
