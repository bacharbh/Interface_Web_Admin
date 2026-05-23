import { useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import { loadAnomalyModel } from '../utils/ml/anomalyModel';
import { prepareTimeSeriesData } from '../utils/ml/featureEngineering';
import { IAnimal } from '../types';

type AnomalyLabel = 'normal' | 'suspect' | 'critical';

interface AnomalyResult {
  score: number;
  label: AnomalyLabel;
  confidence: number;
  isReady: boolean;
}

// Variables globales pour le partage du modèle entre tous les hooks
let cachedModel: tf.LayersModel | null = null;
let isInitializing = false;

export const useAnomalyDetection = (animalId: string, history: IAnimal[]): AnomalyResult => {
  const [result, setResult] = useState<AnomalyResult>({
    score: 0,
    label: 'normal',
    confidence: 1.0,
    isReady: !!cachedModel
  });

  // Initialisation asynchrone Singleton du modèle ML
  useEffect(() => {
    const initModel = async () => {
      if (!cachedModel && !isInitializing) {
        isInitializing = true;
        try {
          cachedModel = await loadAnomalyModel();
          setResult(prev => ({ ...prev, isReady: true }));
        } catch (e) {
          console.error("Impossible de charger le modèle ML", e);
        } finally {
          isInitializing = false;
        }
      } else if (cachedModel && !result.isReady) {
        setResult(prev => ({ ...prev, isReady: true }));
      }
    };
    initModel();
  }, [result.isReady]);

  // Inférence réactive selon les données entrantes
  useEffect(() => {
    // Garde de sécurité et optimisation
    if (!cachedModel || !history || history.length < 5) return;

    const tensorData = prepareTimeSeriesData(history);
    if (!tensorData) return;

    try {
      // tf.tidy prévient les fuites mémoires en nettoyant les tenseurs temporaires
      const predictionValue = tf.tidy(() => {
        // [batch_size, time_steps, features] -> [1, 20, 4]
        const inputTensor = tf.tensor3d([tensorData], [1, 20, 4]);
        
        // Exécution de l'inférence
        const output = cachedModel!.predict(inputTensor) as tf.Tensor;
        
        // Extraction asynchrone vers synchrone de la probabilité finale
        return output.dataSync()[0];
      });

      // Interprétation
      let label: AnomalyLabel = 'normal';
      if (predictionValue >= 0.8) {
        label = 'critical';
      } else if (predictionValue >= 0.6) {
        label = 'suspect';
      }

      const confidence = predictionValue > 0.5 ? predictionValue : 1 - predictionValue;

      setResult({
        score: predictionValue,
        label,
        confidence: parseFloat(confidence.toFixed(2)),
        isReady: true
      });

    } catch (e) {
      console.error(`Erreur d'inférence (Collier ${animalId}):`, e);
    }
  }, [history, animalId]);

  return result;
};
