import numpy as np
from numpy.linalg import inv

class KalmanFilterGPS:
    def __init__(self, dt=30): # dt is interval between samples in seconds
        # State: [x, y, vx, vy]
        self.dt = dt
        
        # State transition matrix
        self.F = np.array([
            [1, 0, dt, 0],
            [0, 1, 0, dt],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ])
        
        # Measurement matrix (only observing x, y)
        self.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ])
        
        # Process noise covariance
        q = 0.0001
        self.Q = np.eye(4) * q
        
        # Measurement noise covariance
        r = 0.00001
        self.R = np.eye(2) * r
        
        # Initial error covariance
        self.P = np.eye(4) * 0.1

    def predict_position(self, last_known_gps, last_known_velocity, herd_displacement):
        """
        Calculates estimated position during blackout.
        herd_displacement: [dx, dy] correction from herd movement
        """
        # Initial state: [lat, lng, v_lat, v_lng]
        x = np.array([last_known_gps[0], last_known_gps[1], last_known_velocity[0], last_known_velocity[1]])
        
        # 1. Predict
        x_pred = self.F @ x
        self.P = self.F @ self.P @ self.F.T + self.Q
        
        # 2. Update with herd correction (as a virtual measurement)
        # We assume the animal moves similarly to the herd centroid
        z = np.array([x_pred[0] + herd_displacement[0], x_pred[1] + herd_displacement[1]])
        
        # Kalman Gain
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ inv(S)
        
        # Update state
        y = z - (self.H @ x_pred)
        x_updated = x_pred + (K @ y)
        self.P = (np.eye(4) - (K @ self.H)) @ self.P
        
        # Confidence radius (simplified from covariance)
        confidence_radius = float(np.sqrt(np.trace(self.P[:2, :2])) * 111320) # Approx meters
        
        return x_updated[0], x_updated[1], confidence_radius

gps_kalman = KalmanFilterGPS()
