#ifndef INFERENCE_ENGINE_H
#define INFERENCE_ENGINE_H

#include <stdint.h>

/**
 * Smart Shepherd Embedded AI Engine
 * 1D-CNN Autoencoder for Anomaly Detection
 */

class InferenceEngine {
public:
    InferenceEngine();
    bool begin();
    
    // window[12][6] -> [temp_C, bpm, spo2, accel_x, accel_y, accel_z]
    bool run_anomaly_detection(float window[12][6]);
    
    void set_threshold(float threshold) { _threshold = threshold; }
    float get_last_mse() { return _last_mse; }

private:
    float _threshold = 0.05f; // Default, will be calibrated per-animal
    float _last_mse = 0.0f;
    bool _initialized = false;
    
    // Normalization helpers
    float normalize_temp(float t) { return (t - 35.0f) / 10.0f; }
    float normalize_bpm(float b) { return b / 200.0f; }
    float normalize_spo2(float s) { return s / 100.0f; }
    float normalize_accel(float a) { return (a + 2.0f) / 4.0f; }
};

#endif
