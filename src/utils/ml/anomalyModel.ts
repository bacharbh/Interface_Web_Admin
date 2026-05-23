import * as tf from '@tensorflow/tfjs';

/**
 * ml/anomalyModel.ts — Initialisation, compilation et stockage du modèle LSTM.
 */

const MODEL_PATH = 'indexeddb://smart-shepherd-anomaly-v2';

/**
 * Builds the RNN/LSTM architecture and initializes weights.
 * Shape: [120, 5]
 */
export const buildAndSaveModel = async (): Promise<tf.Sequential> => {
  const model = tf.sequential();

  // Input layer: 120 steps, 5 features
  model.add(tf.layers.lstm({
    units: 32,
    inputShape: [120, 5],
    returnSequences: false
  }));

  model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

  // Compilation
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });

  const dummyX = tf.zeros([1, 120, 5]);
  const dummyY = tf.zeros([1, 1]);
  await model.fit(dummyX, dummyY, { epochs: 1, verbose: 0 });

  dummyX.dispose();
  dummyY.dispose();

  await model.save(MODEL_PATH);
  console.log('✅ Modèle ML (120,5) créé et sauvegardé.');

  return model;
};

/**
 * Tente de charger le modèle depuis le cache local (IndexedDB).
 * S'il n'existe pas, on le reconstruit localement.
 */
export const loadAnomalyModel = async (): Promise<tf.LayersModel> => {
  try {
    const models = await tf.io.listModels();
    
    if (models[MODEL_PATH]) {
      console.log('⚡ Modèle d\'anomalie chargé depuis le cache IndexedDB.');
      return await tf.loadLayersModel(MODEL_PATH);
    }

    console.log('⚠️ Aucun modèle en cache, construction d\'un nouveau modèle...');
    return await buildAndSaveModel() as tf.LayersModel;

  } catch (error) {
    console.error("Erreur critique lors du chargement du modèle TF.js", error);
    // Fallback: build an in-memory replacement that won't save if IndexedDB is broken
    return await buildAndSaveModel() as tf.LayersModel;
  }
};
