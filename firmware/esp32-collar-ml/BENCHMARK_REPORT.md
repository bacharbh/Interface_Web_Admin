# TinyML Performance Benchmark Report (ESP32)

## 1. Resource Consumption
| Metric | Result | Constraint | Status |
|--------|--------|------------|--------|
| **Model Size** | 12.4 KB | < 32 KB | ✅ Pass |
| **Peak RAM (Arena)** | 64.2 KB | < 80 KB | ✅ Pass |
| **Inference Latency** | 32.4 ms | < 50 ms | ✅ Pass |
| **Power Overhead** | < 2% | N/A | ✅ Pass |

## 2. Accuracy (AUC-ROC)
| Anomaly Class | AUC-ROC | Scenario |
|---------------|---------|----------|
| **Fever** | 0.96 | Temp > 40.5, BPM High |
| **Tachycardia** | 0.92 | BPM > 120 |
| **Fall** | 0.98 | Accel Spike + Stillness |
| **Distress** | 0.89 | Erratic Movement |
| **Hypoxia** | 0.94 | SpO2 < 92% |

## 3. Threshold Calibration Benefit
*   **Global Threshold FPR**: 18.4%
*   **Per-Animal (99th Pct) FPR**: 2.8%
*   **Improvement**: 85% reduction in false alarms.

## 4. Hardware Details
*   **MCU**: ESP32-WROOM-32 (Dual Core)
*   **Clock**: 240 MHz
*   **Runtime**: TFLite Micro (ESP32 Optimized)
