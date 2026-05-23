import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def generate_disease_patterns(pattern_type, window_size=120):
    """
    Generates realistic physiological patterns based on ovine references.
    """
    data = np.zeros((window_size, 5))
    
    if pattern_type == 'fever':
        # Linear increase in temp, HR follows, activity drops
        for i in range(window_size):
            data[i, 0] = 38.5 + (i / window_size) * 2.5 # +2.5C
            data[i, 1] = 70 + (i / window_size) * 40 # +40 BPM
            data[i, 2] = max(0, 2 - (i / window_size) * 2) # Activity drops to 0
            data[i, 3] = 90 - (i / window_size) * 10 # Battery drain
            data[i, 4] = -50
            
    elif pattern_type == 'mastitis':
        # Sharp temp spike, highly erratic HR
        for i in range(window_size):
            data[i, 0] = 39.0 + (np.sin(i/10) * 0.5) + (i/window_size) * 2.0
            data[i, 1] = 80 + np.random.normal(0, 15)
            data[i, 2] = 0.5 # Low activity
            
    elif pattern_type == 'pre_labour':
        # Intense activity spike then sharp drop
        mid = window_size // 2
        for i in range(window_size):
            if i < mid:
                data[i, 2] = 1 + (i / mid) * 3 # Activity spike
                data[i, 1] = 75 + (i / mid) * 20
            else:
                data[i, 2] = 4 - ((i-mid) / mid) * 4 # Sharp drop
                data[i, 1] = 95 - ((i-mid) / mid) * 10
            data[i, 0] = 38.8
            
    # Add Gaussian noise
    data += np.random.normal(0, 0.05, data.shape)
    return data

def generate_health_data(num_animals=10, points_per_animal=1000):
    """
    Generates synthetic health data with anomalies for training.
    Features: temperature, heart_rate, activity, battery, rssi
    """
    data = []
    
    for animal_id in range(num_animals):
        # Base healthy stats
        temp_base = 38.5
        hr_base = 75
        activity_base = 1 # Resting
        battery = 100
        rssi = -50
        
        start_time = datetime.now() - timedelta(days=7)
        
        for i in range(points_per_animal):
            timestamp = start_time + timedelta(minutes=i)
            
            # Normal variations
            temp = temp_base + np.random.normal(0, 0.2)
            hr = hr_base + np.random.normal(0, 5)
            activity = np.random.choice([0, 1, 2, 3], p=[0.1, 0.5, 0.3, 0.1])
            battery -= 0.001
            rssi += np.random.normal(0, 2)
            
            # Inject anomalies (e.g., fever or tachycardia)
            label = 0
            if i > 800 and i < 850 and animal_id % 3 == 0:
                temp += 1.5 # Fever
                hr += 20 # Tachycardia
                label = 1
                
            data.append({
                'animal_id': f"sheep_{animal_id}",
                'timestamp': timestamp,
                'temperature': temp,
                'heart_rate': hr,
                'activity': activity,
                'battery': battery,
                'rssi': rssi,
                'label': label
            })
            
    return pd.DataFrame(data)

if __name__ == "__main__":
    df = generate_health_data()
    df.to_csv("health_training_data.csv", index=False)
    print(f"Generated {len(df)} records for training.")
