# Smart Shepherd: ML Data & Labelling Strategy

## 1. The Cold-Start Problem
Currently, the system has high telemetry volume but **zero ground-truth labels**. We cannot train a supervised classifier (e.g., "This IS Pneumonia") without confirmed veterinary outcomes.

## 2. Pipeline Solution
We are implementing a 4-stage "Flywheel" approach:

### Phase 1: Synthetic Pre-training (Days 1-7)
- **Action**: Use physiological models to generate 50,000 "disease-like" windows (Fever, Mastitis, Pre-labour).
- **Goal**: Train an initial LSTM to recognize **patterns of change**, even if it doesn't know the specific name yet.
- **Metric**: 0.75 AUC-ROC on synthetic validation.

### Phase 2: Active Labelling (Months 1-3)
- **Action**: The `/admin/labelling` interface allows Vets to "name" the anomalies flagged by the TFLite edge model.
- **Gamification**: Farms compete on a leaderboard for "Labelling Completion Rate" to ensure high data throughput.
- **Target**: Collect 500 high-quality real-world labels.

### Phase 3: Active Learning Loop (Continuous)
- **Action**: As labels arrive, Celery background tasks trigger incremental retraining.
- **Promotion**: New models are registered in MLflow and only pushed to production if they show > 1% performance lift.

### Phase 4: Full Supervised Intelligence (Month 6+)
- **Action**: Fine-tune the pre-trained LSTM on the accumulated real dataset.
- **Expected Outcome**: > 92% Precision in disease classification.

## 3. Milestones & Performance
| Labels | Strategy | Expected AUC-ROC |
|--------|----------|------------------|
| 0      | Synthetic Only | 0.65 (Anomaly Detection) |
| 50     | Few-shot Fine-tuning | 0.72 |
| 200    | Active Learning Start | 0.84 |
| 1000+  | Full Supervised | 0.94 |
