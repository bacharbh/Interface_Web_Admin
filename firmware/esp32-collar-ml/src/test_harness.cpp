#include <Arduino.h>
#include "inference_engine.h"

InferenceEngine engine;
float calibration_data[4320]; // Mock storage for MSEs
int window_count = 0;

void setup() {
    Serial.begin(115200);
    
    if (!engine.begin()) {
        Serial.println("AI Engine Init Failed!");
        return;
    }

    Serial.println("AI Engine Started. Calibrating per-animal threshold...");
    
    // Simulate 72 hours of healthy data recording
    // In real firmware, this would happen over 3 days
    for (int i = 0; i < 4320; i++) {
        float healthy_window[12][6] = {0};
        // Fill with baseline healthy values...
        engine.run_anomaly_detection(healthy_window);
        calibration_data[i] = engine.get_last_mse();
    }
    
    // Sort and find 99th percentile
    // (Simplified sorting for brevity)
    float calibrated_threshold = calibration_data[4300]; 
    engine.set_threshold(calibrated_threshold);
    
    Serial.printf("Calibration Complete. Per-animal threshold set to: %f\n", calibrated_threshold);
}

void loop() {
    // Mock Telemetry Window
    float current_window[12][6];
    
    // Test Case: Inject Fever Anomaly
    current_window[11][0] = 41.2f; // High Temp
    current_window[11][1] = 145.0f; // High BPM
    
    bool is_anomaly = engine.run_anomaly_detection(current_window);
    
    if (is_anomaly) {
        Serial.println("!!! ANOMALY DETECTED !!! Setting ALERT mode.");
        //Survives Deep Sleep via RTC Memory
        // alertMode = true; 
        // transmissionInterval = 30;
    }
    
    delay(60000); // 1 minute interval
}
