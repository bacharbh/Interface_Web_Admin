import AnomalyEvent from '../models/AnomalyEvent.js';

// Fallback if @tensorflow/tfjs is not installed locally
let tf;
try {
  // Use dynamic import or require for optional dependency
  tf = await import('@tensorflow/tfjs');
} catch (e) {
  console.warn('⚠️ TensorFlow.js is not installed. Using fallback heuristic anomaly detection.');
}

class LSTMDetectionService {
  constructor() {
    // Map pour stocker l'historique des 7 derniers jours (fenêtre glissante) pour chaque animal
    // Clé: animalId, Valeur: Tableau de tenseurs/features
    this.baselines = new Map();
    
    // Map pour stocker les modèles spécifiques par animal
    this.models = new Map();
  }

  async buildModel() {
    if (!tf) return null;
    
    const model = tf.sequential();
    // Couche LSTM pour séquences temporelles : prend une fenêtre de 10 lectures avec 3 features
    model.add(tf.layers.lstm({ units: 16, inputShape: [10, 3], returnSequences: false }));
    // Couche dense d'auto-encodage : tente de prédire l'état suivant
    model.add(tf.layers.dense({ units: 3, activation: 'relu' }));
    
    model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
    return model;
  }

  /**
   * Traite la nouvelle télémétrie entrante
   * @param {Object} data - { animalId, farmId, temperature, movement_rate, heart_rate }
   * @returns {Promise<number>} - Score d'anomalie entre 0 et 1
   */
  async processTelemetry(data) {
    const { animalId, farmId, temperature, movement_rate, heart_rate = 80 } = data;
    
    // Initialisation du buffer de l'animal si inconnu
    if (!this.baselines.has(animalId)) {
      this.baselines.set(animalId, []);
      if (tf) {
        this.models.set(animalId, await this.buildModel());
      }
    }

    const history = this.baselines.get(animalId);
    // On ajoute la data [Température, Mouvement, Fréquence Cardiaque]
    history.push([temperature, movement_rate, heart_rate]);

    let score = 0.05; // Base normale

    // Nous avons besoin d'au moins 10 tics pour remplir la séquence LSTM
    if (history.length >= 10) {
      const recentSequence = history.slice(-10);
      
      if (tf && this.models.get(animalId)) {
        try {
          const model = this.models.get(animalId);
          // Création du Tensor d'entrée 3D: [batch, timesteps, features] -> [1, 10, 3]
          const inputTensor = tf.tensor3d([recentSequence], [1, 10, 3]);
          
          // L'IA prédit les prochaines métriques vitales en se basant sur le Baseline appris
          const prediction = model.predict(inputTensor);
          const predictedValues = await prediction.data();
          
          // Calcul du MSE (Mean Squared Error) entre la réalité et la prédiction
          const actualValues = [temperature, movement_rate, heart_rate];
          let mse = 0;
          for(let i = 0; i < 3; i++) {
            mse += Math.pow(actualValues[i] - predictedValues[i], 2);
          }
          
          // Plus l'erreur est grande, plus c'est une anomalie (comportement imprévisible)
          // Normalisation: MSE de 0->0.0, MSE de >50 -> 1.0
          score = Math.min(1.0, mse / 50);

          // Cleanup memory
          inputTensor.dispose();
          prediction.dispose();
        } catch (e) {
          console.error(`TFJS Error processing animal ${animalId}:`, e);
          score = this.fallbackHeuristic(temperature, movement_rate);
        }
      } else {
        // Fallback Heuristique si TFJS n'est pas chargé
        score = this.fallbackHeuristic(temperature, movement_rate);
      }

      // Maintien de la fenêtre glissante à 7 jours max (10080 minutes)
      if (history.length > 10080) {
        history.shift(); 
      }
    }

    // 3. Déclenchement d'Alerte si Seuil > 0.85
    if (score > 0.85) {
       console.log(`🚨 [ANOMALY AI] Détection Critique sur Collier ${animalId} - Score: ${(score*100).toFixed(1)}%`);
       
       const event = new AnomalyEvent({
         animalId,
         farmId: farmId || 'DEFAULT_FARM',
         score,
         features: { temperature, movementRate: movement_rate, heartRate: heart_rate }
       });

       await event.save().catch(e => console.error('MongoDB Save Error (AnomalyEvent):', e));
       
       // Note: Dans une application complète, on émettrait aussi via socket.io pour le composant React
    }

    return score;
  }

  fallbackHeuristic(temperature, movementRate) {
    // Calcul simpliste sans Machine Learning
    let s = 0.1;
    if (temperature > 40 || temperature < 37) s += 0.5;
    if (movementRate === 0) s += 0.4;
    return Math.min(1.0, s);
  }
}

export const anomalyService = new LSTMDetectionService();
