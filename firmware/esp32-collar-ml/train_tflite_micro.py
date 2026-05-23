import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
import os
import json

# 1. DATA GENERATION
def generate_synthetic_dataset(num_samples=50000):
    # Healthy Baseline
    # [temp_C, bpm, spo2, accel_x, accel_y, accel_z]
    # Normal: 38.5-39.5 C, 60-90 BPM, 97-100% SpO2, low accel variance
    temp = np.random.uniform(38.5, 39.5, (num_samples, 12, 1))
    bpm = np.random.uniform(60, 90, (num_samples, 12, 1))
    spo2 = np.random.uniform(97, 100, (num_samples, 12, 1))
    accel = np.random.normal(0, 0.05, (num_samples, 12, 3))
    
    X = np.concatenate([temp, bpm, spo2, accel], axis=-1)
    
    # Simple Normalization
    # Temp: (x-35)/10, BPM: x/200, SpO2: x/100, Accel: (x+2)/4
    X[:, :, 0] = (X[:, :, 0] - 35) / 10.0
    X[:, :, 1] = X[:, :, 1] / 200.0
    X[:, :, 2] = X[:, :, 2] / 100.0
    X[:, :, 3:] = (X[:, :, 3:] + 2) / 4.0
    
    return X.astype(np.float32)

def generate_anomalies(num_samples=1000):
    anomalies = []
    # 1. Fever
    fever = generate_synthetic_dataset(num_samples // 5)
    fever[:, :, 0] += 0.2 # +2 degrees
    fever[:, :, 1] += 0.3 # +60 BPM
    anomalies.append(fever)
    
    # 2. Tachycardia
    tachy = generate_synthetic_dataset(num_samples // 5)
    tachy[:, :, 1] += 0.4 # High BPM
    anomalies.append(tachy)
    
    # 3. Fall
    fall = generate_synthetic_dataset(num_samples // 5)
    fall[:, 6:8, 3:] += 0.8 # Sudden spike
    anomalies.append(fall)
    
    # 4. Distress
    distress = generate_synthetic_dataset(num_samples // 5)
    distress[:, :, 3:] += np.random.uniform(0.2, 0.5, (num_samples // 5, 12, 3))
    anomalies.append(distress)
    
    # 5. Hypoxia
    hypoxia = generate_synthetic_dataset(num_samples // 5)
    hypoxia[:, :, 2] -= 0.15 # -15% SpO2
    anomalies.append(hypoxia)
    
    return np.concatenate(anomalies, axis=0)

# 2. MODEL DESIGN
def build_autoencoder():
    model = models.Sequential([
        # Encoder
        layers.Input(shape=(12, 6)),
        layers.Conv1D(16, 3, activation='relu', padding='same'),
        layers.MaxPooling1D(2),
        layers.Conv1D(8, 3, activation='relu', padding='same'),
        
        # Decoder
        layers.UpSampling1D(2),
        layers.Conv1D(16, 3, activation='relu', padding='same'),
        layers.Conv1D(6, 3, activation='sigmoid', padding='same')
    ])
    model.compile(optimizer='adam', loss='mse')
    return model

# 3. MAIN PIPELINE
if __name__ == "__main__":
    X_train = generate_synthetic_dataset(50000)
    X_val = generate_synthetic_dataset(5000)
    X_anomaly = generate_anomalies(5000)
    
    model = build_autoencoder()
    model.summary()
    
    model.fit(X_train, X_train, epochs=20, batch_size=64, validation_data=(X_val, X_val))
    
    # Determine threshold (99th percentile of training error)
    reconstructions = model.predict(X_train)
    mse = np.mean(np.square(X_train - reconstructions), axis=(1, 2))
    threshold = np.percentile(mse, 99)
    print(f"Calculated MSE Threshold: {threshold}")
    
    # 4. QUANTIZATION
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    
    # Representative dataset for INT8 quantization
    def representative_data_gen():
        for i in range(100):
            yield [X_train[i:i+1]]
            
    converter.representative_dataset = representative_data_gen
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.float32 # Keep float inputs for ease of use in firmware
    converter.inference_output_type = tf.float32
    
    tflite_model = converter.convert()
    
    with open("model_quantized.tflite", "wb") as f:
        f.write(tflite_model)
        
    # Save threshold
    with open("threshold_config.json", "w") as f:
        json.dump({"reconstruction_mse_threshold": float(threshold)}, f)
        
    print(f"Model Size: {len(tflite_model) / 1024:.2f} KB")
    
    # 5. EXPORT TO C HEADER
    os.system('xxd -i model_quantized.tflite > model_data.h')
    print("Exported model_data.h")
