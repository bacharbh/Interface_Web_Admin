import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIoTStore } from '../../hooks/useIoTStore';
import { Brain, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { detectBehaviorAlerts } from '../../ai/behaviorDetector';

/**
 * AIAnalysis Component
 * Automatically calls /api/ai/analyze every 30s or when critical animals detected
 * Implements retry (2x), timeout (10s), displays status and updates dashboard in real-time
 */
const AIAnalysis = () => {
    const devices = useIoTStore(state => state.devices);
    const history = useIoTStore(state => state.history);
    const aiAlerts = useIoTStore(state => state.aiAlerts);
    const addAIAlert = useIoTStore(state => state.addAIAlert);
    const setAIAlerts = useIoTStore(state => state.setAIAlerts);
    const aiSettings = useIoTStore(state => state.aiSettings);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [lastAnalysis, setLastAnalysis] = useState(null);
    const [error, setError] = useState(null);
    const [isDegraded, setIsDegraded] = useState(false);
    const [lastUpdateTime, setLastUpdateTime] = useState(null);
    const pollIntervalRef = useRef(null);
    const activeRequestControllerRef = useRef(null);
    const retryTimeoutRef = useRef(null);
    const behaviorAlertKeysRef = useRef(new Set());
    const lastAnalysisAtRef = useRef(0);

    /**
     * Helper: Fetch with retry and timeout
     */
    const fetchWithRetry = useCallback(async (url, options = {}, maxRetries = 2) => {
        const timeout = 10000; // 10 seconds
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                retryTimeoutRef.current = timeoutId;

                if (options.signal) {
                    if (options.signal.aborted) {
                        controller.abort();
                    } else {
                        options.signal.addEventListener('abort', () => controller.abort(), { once: true });
                    }
                }

                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);
                if (retryTimeoutRef.current === timeoutId) {
                    retryTimeoutRef.current = null;
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            } catch (err) {
                lastError = err;

                if (err?.name === 'AbortError' || options.signal?.aborted) {
                    throw err;
                }

                console.warn(`Attempt ${attempt + 1}/${maxRetries + 1} failed:`, err.message);

                // Wait before retrying (exponential backoff: 500ms, 1000ms)
                if (attempt < maxRetries) {
                    await new Promise((resolve, reject) => {
                        const backoffTimeoutId = setTimeout(() => {
                            if (retryTimeoutRef.current === backoffTimeoutId) {
                                retryTimeoutRef.current = null;
                            }
                            resolve();
                        }, 500 * (attempt + 1));

                        retryTimeoutRef.current = backoffTimeoutId;

                        if (options.signal) {
                            options.signal.addEventListener('abort', () => {
                                clearTimeout(backoffTimeoutId);
                                if (retryTimeoutRef.current === backoffTimeoutId) {
                                    retryTimeoutRef.current = null;
                                }
                                reject(new DOMException('The operation was aborted.', 'AbortError'));
                            }, { once: true });
                        }
                    });
                }
            }
        }

        throw lastError;
    }, []);

    /**
     * Extract critical animals and data for analysis
     */
    const getCriticalAnimalsData = useCallback(() => {
        const animals = Object.values(devices)
            .filter(a => a && a.collar_id)
            .map(a => ({
                collar_id: a.collar_id,
                name: a.name || `Animal ${a.collar_id}`,
                bpm: a.heartRate || 0,
                temperature: a.temperature || 0,
                activity: a.activity_level || 0,
                health: a.health || 'Unknown',
                status: a.status || 'SAFE',
                battery: a.battery || 0,
            }));

        // Prioritize critical animals
        const critical = animals.filter(a => a.status === 'CRITICAL' || a.health === 'Critical');
        const toAnalyze = critical.length > 0 ? critical : animals.slice(0, 5);

        return toAnalyze;
    }, [devices]);

    /**
     * Main analysis function
     */
    const performAnalysis = useCallback(async () => {
        const requestController = new AbortController();
        activeRequestControllerRef.current = requestController;

        try {
            const now = Date.now();
            if (now - lastAnalysisAtRef.current < 30000) {
                return;
            }
            lastAnalysisAtRef.current = now;

            const animalsData = getCriticalAnimalsData();

            // Skip if no animals
            if (animalsData.length === 0) {
                return;
            }

            setIsAnalyzing(true);
            setError(null);
            setIsDegraded(false);

            const result = await fetchWithRetry('/api/ai/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ animals: animalsData }),
                signal: requestController.signal,
            });

            if (result.success && result.data) {
                const { summary, riskLevel, riskAnimalIds, suggestions } = result.data;

                setLastAnalysis({
                    summary,
                    riskLevel,
                    riskAnimalIds,
                    suggestions,
                    timestamp: result.timestamp,
                    animalCount: animalsData.length,
                });

                // Update store with structured AI analysis
                const newAlert = {
                    id: `ai-analysis-${Date.now()}`,
                    type: 'ai-analysis',
                    animalName: 'Troupeau',
                    message: summary,
                    timestamp: result.timestamp,
                    riskScore: riskLevel === 'CRITICAL' ? 95 : riskLevel === 'HIGH' ? 75 : riskLevel === 'MEDIUM' ? 50 : 25,
                    animalId: riskAnimalIds?.[0] || '',
                    riskLevel,
                    riskAnimalIds,
                    suggestions,
                };

                // Add to alerts for real-time dashboard update
                addAIAlert(newAlert);

                // Optional: Trigger notifications for high-risk analysis
                if ((riskLevel === 'HIGH' || riskLevel === 'CRITICAL') && typeof Notification !== 'undefined') {
                    if (Notification.permission === 'granted') {
                        new Notification('Alerte IA - Santé du troupeau', {
                            body: summary,
                            icon: '🐑',
                        });
                    }
                }
            } else {
                setError('Response format invalid');
                setIsDegraded(true);
            }
        } catch (err) {
            if (err?.name === 'AbortError') {
                return;
            }
            console.error('AI Analysis failed after retries:', err);
            setError(err.message || 'Analysis failed');
            setIsDegraded(true);
        } finally {
            if (activeRequestControllerRef.current === requestController) {
                activeRequestControllerRef.current = null;
            }
            setIsAnalyzing(false);
            setLastUpdateTime(new Date());
        }
    }, [getCriticalAnimalsData, fetchWithRetry, addAIAlert]);

    /**
     * Monitor behavior anomalies continuously from live/simulated store snapshots
     */
    useEffect(() => {
        const detectedAlerts = detectBehaviorAlerts(devices, history, {
            immobilityMinutes: aiSettings.alertThresholds.immobilityMinutes,
            gpsStationaryMinutes: aiSettings.alertThresholds.immobilityMinutes,
            temperatureMinutes: 10,
            speedThresholdKmh: 0.1,
            gpsStationaryRadiusMeters: 5,
            temperatureThresholdC: aiSettings.alertThresholds.temperatureCritical,
        });

        detectedAlerts.forEach((alert) => {
            if (behaviorAlertKeysRef.current.has(alert.signature)) return;
            behaviorAlertKeysRef.current.add(alert.signature);
            addAIAlert({
                ...alert,
                animalId: alert.animalId,
                animalName: alert.animalName,
                type: 'behavior',
                message: alert.message,
            });
        });

        if (behaviorAlertKeysRef.current.size > 200) {
            behaviorAlertKeysRef.current = new Set(Array.from(behaviorAlertKeysRef.current).slice(-100));
        }
    }, [devices, history, aiSettings, addAIAlert]);

    /**
     * Check if critical animals exist
     */
    const hasCriticalAnimals = useCallback(() => {
        return Object.values(devices).some(a => a && (a.status === 'CRITICAL' || a.health === 'Critical'));
    }, [devices]);

    /**
     * Effect: Poll every 30 seconds
     */
    const performAnalysisRef = useRef(performAnalysis);

    useEffect(() => {
        performAnalysisRef.current = performAnalysis;
    }, [performAnalysis]);

    useEffect(() => {
        // Run once on mount
        performAnalysisRef.current();

        // Set new interval (30 seconds)
        pollIntervalRef.current = setInterval(() => {
            performAnalysisRef.current();
        }, 30000);

        return () => {
            if (activeRequestControllerRef.current) {
                activeRequestControllerRef.current.abort();
                activeRequestControllerRef.current = null;
            }

            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }

            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, []);

    // Render status indicators (can be shown inline or as toast)
    return (
        <div>
            {/* Analysis in progress - blue banner */}
            {isAnalyzing && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-pulse">
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700 flex items-center gap-2 text-sm shadow-lg">
                        <Brain className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                        <span className="text-blue-700 dark:text-blue-300 font-medium">Analyse du troupeau en cours…</span>
                    </div>
                </div>
            )}

            {/* Local AI mode - neutral info banner */}
            {isDegraded && !isAnalyzing && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700 flex items-center gap-2 text-sm shadow-lg">
                        <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-blue-700 dark:text-blue-300 font-medium">IA locale active — Connecter le service FastAPI pour l'analyse complète</span>
                    </div>
                </div>
            )}

            {/* Success - green banner (temporary) */}
            {lastAnalysis && !isAnalyzing && !isDegraded && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in duration-500">
                    <div className="px-4 py-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700 flex items-center gap-2 text-sm shadow-lg">
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-green-700 dark:text-green-300 font-medium">Analyse IA mise à jour</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIAnalysis;
