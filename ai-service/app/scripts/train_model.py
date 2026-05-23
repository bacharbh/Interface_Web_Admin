import tensorflow as tf
import numpy as np
import pandas as pd
from ..models.health_lstm import health_model
from .synthetic_data import generate_health_data
import os

def train():
    print("Starting AI Training Pipeline...")
    
    # 1. Load Data
    if not os.path.exists("health_training_data.csv"):
        print("Generating synthetic training data...")
        df = generate_health_data(num_animals=20, points_per_animal=500)
        df.to_csv("health_training_data.csv", index=False)
    else:
        df = pd.read_csv("health_training_data.csv")
    
    # 2. Preprocess
    # Features: [temperature, heart_rate, activity, battery, rssi]
    feature_cols = ['temperature', 'heart_rate', 'activity', 'battery', 'rssi']
    
    # Simple normalization (min-max)
    # In production, use saved scaler
    for col in feature_cols:
        df[col] = (df[col] - df[col].min()) / (df[col].max() - df[col].min())
        
    # 3. Create Windows
    window_size = 120
    X, y = [], []
    
    for animal_id in df['animal_id'].unique():
        animal_df = df[df['animal_id'] == animal_id]
        values = animal_df[feature_cols].values
        labels = animal_df['label'].values
        
        for i in range(len(values) - window_size):
            X.append(values[i:i+window_size])
            y.append(labels[i+window_size])
            
    X = np.array(X)
    y = np.array(y)
    
    print(f"X shape: {X.shape}, y shape: {y.shape}")
    
    # 4. Build and Train
    model = health_model._build_model()
    model.fit(X, y, epochs=10, batch_size=32, validation_split=0.2)
    
    # 5. Save
    model_path = "models/health_v2"
    if not os.path.exists("models"):
        os.makedirs("models")
    model.save(model_path)
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train()
