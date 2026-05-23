import { IAnimal } from '../types';

export type BehaviorAlertType = 'IMMOBILITY' | 'GPS_ANOMALY' | 'HYPERTHERMIA';

export interface BehaviorDetectionConfig {
    immobilityMinutes: number;
    gpsStationaryMinutes: number;
    temperatureMinutes: number;
    speedThresholdKmh: number;
    gpsStationaryRadiusMeters: number;
    temperatureThresholdC: number;
}

export interface BehaviorHistoryPoint extends Partial<Pick<IAnimal, 'speed' | 'temperature' | 'lat' | 'lng'>> {
    collar_id?: string;
    name?: string;
    lastUpdate?: string;
    timestamp?: string | number | Date;
}

export interface BehaviorAlert {
    id: string;
    signature: string;
    type: 'behavior';
    behaviorType: BehaviorAlertType;
    animalId: string;
    animalName: string;
    timestamp: string;
    message: string;
    riskScore: number;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    metric: string;
    details: {
        threshold: number;
        durationMinutes: number;
        actual?: number;
        unit?: string;
    };
}

const DEFAULT_CONFIG: BehaviorDetectionConfig = {
    immobilityMinutes: 15,
    gpsStationaryMinutes: 20,
    temperatureMinutes: 10,
    speedThresholdKmh: 0.1,
    gpsStationaryRadiusMeters: 5,
    temperatureThresholdC: 40,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toTimestamp = (point: BehaviorHistoryPoint, fallbackMs: number): number => {
    const raw = point.timestamp ?? point.lastUpdate;
    if (!raw) return fallbackMs;
    const time = new Date(raw).getTime();
    return Number.isFinite(time) ? time : fallbackMs;
};

const haversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusMeters = 6_371_000;
    const deltaLat = toRad(lat2 - lat1);
    const deltaLng = toRad(lng2 - lng1);
    const a = Math.sin(deltaLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLng / 2) ** 2;
    return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
};

const buildAlert = (
    animal: BehaviorHistoryPoint,
    behaviorType: BehaviorAlertType,
    message: string,
    metric: string,
    timestampMs: number,
    riskScore: number,
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    details: BehaviorAlert['details']
): BehaviorAlert => {
    const animalId = animal.collar_id || 'unknown';
    const animalName = animal.name || `Animal ${animalId}`;
    return {
        id: `${animalId}-${behaviorType}-${Math.floor(timestampMs / 300000)}`,
        signature: `${animalId}:${behaviorType}:${Math.floor(timestampMs / 300000)}`,
        type: 'behavior',
        behaviorType,
        animalId,
        animalName,
        timestamp: new Date(timestampMs).toISOString(),
        message,
        riskScore: clamp(riskScore, 0, 100),
        severity,
        metric,
        details,
    };
};

const getWindow = (points: Array<{ timestampMs: number; point: BehaviorHistoryPoint }>, minutes: number) => {
    if (points.length === 0) return [];
    const latestTime = points[points.length - 1].timestampMs;
    const cutoff = latestTime - minutes * 60_000;
    return points.filter((entry) => entry.timestampMs >= cutoff);
};

const latestValidPoint = (points: BehaviorHistoryPoint[]) => {
    const reversed = [...points].reverse();
    return reversed.find((point) =>
        Number.isFinite(point.lat ?? NaN)
        || Number.isFinite(point.lng ?? NaN)
        || Number.isFinite(point.speed ?? NaN)
        || Number.isFinite(point.temperature ?? NaN)
    );
};

const detectImmobility = (
    animal: BehaviorHistoryPoint,
    points: Array<{ timestampMs: number; point: BehaviorHistoryPoint }>,
    config: BehaviorDetectionConfig
) => {
    const window = getWindow(points, config.immobilityMinutes);
    if (window.length < 2) return null;

    const allSlow = window.every(({ point }) => (point.speed ?? animal.speed ?? 0) < config.speedThresholdKmh);
    const durationMinutes = (window[window.length - 1].timestampMs - window[0].timestampMs) / 60_000;
    if (!allSlow || durationMinutes < config.immobilityMinutes) return null;

    const latestTime = window[window.length - 1].timestampMs;
    return buildAlert(
        animal,
        'IMMOBILITY',
        `Immobilité prolongée depuis ${durationMinutes.toFixed(0)} min`,
        'speed',
        latestTime,
        88,
        'WARNING',
        {
            threshold: config.speedThresholdKmh,
            durationMinutes,
            actual: Math.max(...window.map(({ point }) => point.speed ?? animal.speed ?? 0)),
            unit: 'km/h',
        }
    );
};

const detectGpsAnomaly = (
    animal: BehaviorHistoryPoint,
    points: Array<{ timestampMs: number; point: BehaviorHistoryPoint }>,
    config: BehaviorDetectionConfig
) => {
    const window = getWindow(points, config.gpsStationaryMinutes);
    const gpsPoints = window.filter(({ point }) => Number.isFinite(point.lat ?? NaN) && Number.isFinite(point.lng ?? NaN));
    if (gpsPoints.length < 2) return null;

    const first = gpsPoints[0].point;
    const latest = gpsPoints[gpsPoints.length - 1].point;
    const spanMinutes = (gpsPoints[gpsPoints.length - 1].timestampMs - gpsPoints[0].timestampMs) / 60_000;
    const movementMeters = haversineMeters(first.lat as number, first.lng as number, latest.lat as number, latest.lng as number);
    if (spanMinutes < config.gpsStationaryMinutes || movementMeters > config.gpsStationaryRadiusMeters) return null;

    const latestTime = gpsPoints[gpsPoints.length - 1].timestampMs;
    return buildAlert(
        animal,
        'GPS_ANOMALY',
        `Position anormale: déplacement <= ${config.gpsStationaryRadiusMeters}m sur ${spanMinutes.toFixed(0)} min`,
        'lat/lng',
        latestTime,
        82,
        'WARNING',
        {
            threshold: config.gpsStationaryRadiusMeters,
            durationMinutes: spanMinutes,
            actual: movementMeters,
            unit: 'm',
        }
    );
};

const detectHyperthermia = (
    animal: BehaviorHistoryPoint,
    points: Array<{ timestampMs: number; point: BehaviorHistoryPoint }>,
    config: BehaviorDetectionConfig
) => {
    const window = getWindow(points, config.temperatureMinutes);
    if (window.length < 2) return null;

    let runStartIndex = -1;
    for (let index = 0; index < window.length; index++) {
        const temp = window[index].point.temperature ?? animal.temperature ?? 0;
        if (temp > config.temperatureThresholdC) {
            if (runStartIndex === -1) runStartIndex = index;
        } else {
            if (runStartIndex !== -1) {
                const durationMinutes = (window[index - 1].timestampMs - window[runStartIndex].timestampMs) / 60_000;
                if (durationMinutes >= config.temperatureMinutes) {
                    const latestTime = window[index - 1].timestampMs;
                    return buildAlert(
                        animal,
                        'HYPERTHERMIA',
                        `Hyperthermie prolongée: température > ${config.temperatureThresholdC}°C depuis ${durationMinutes.toFixed(0)} min`,
                        'temperature',
                        latestTime,
                        92,
                        'CRITICAL',
                        {
                            threshold: config.temperatureThresholdC,
                            durationMinutes,
                            actual: Math.max(...window.slice(runStartIndex, index).map(({ point }) => point.temperature ?? animal.temperature ?? 0)),
                            unit: '°C',
                        }
                    );
                }
                runStartIndex = -1;
            }
        }
    }

    if (runStartIndex !== -1) {
        const durationMinutes = (window[window.length - 1].timestampMs - window[runStartIndex].timestampMs) / 60_000;
        if (durationMinutes >= config.temperatureMinutes) {
            const latestTime = window[window.length - 1].timestampMs;
            return buildAlert(
                animal,
                'HYPERTHERMIA',
                `Hyperthermie prolongée: température > ${config.temperatureThresholdC}°C depuis ${durationMinutes.toFixed(0)} min`,
                'temperature',
                latestTime,
                92,
                'CRITICAL',
                {
                    threshold: config.temperatureThresholdC,
                    durationMinutes,
                    actual: Math.max(...window.slice(runStartIndex).map(({ point }) => point.temperature ?? animal.temperature ?? 0)),
                    unit: '°C',
                }
            );
        }
    }

    return null;
};

export const detectBehaviorAlerts = (
    animals: Record<string, BehaviorHistoryPoint> = {},
    historyByAnimal: Record<string, BehaviorHistoryPoint[]> = {},
    config: Partial<BehaviorDetectionConfig> = {}
): BehaviorAlert[] => {
    const settings: BehaviorDetectionConfig = {
        ...DEFAULT_CONFIG,
        ...config,
    };

    const alerts: BehaviorAlert[] = [];

    Object.entries(animals).forEach(([animalId, animal]) => {
        const history = (historyByAnimal[animalId] || []).slice(-120);
        const fallbackNow = Date.now();
        const points = history.length > 0
            ? history.map((point, index) => ({ timestampMs: toTimestamp(point, fallbackNow - ((history.length - 1 - index) * 60_000)), point }))
            : [
                {
                    timestampMs: fallbackNow,
                    point: animal,
                },
            ];

        const behaviorSources = [
            detectImmobility(animal, points, settings),
            detectGpsAnomaly(animal, points, settings),
            detectHyperthermia(animal, points, settings),
        ].filter(Boolean) as BehaviorAlert[];

        behaviorSources.forEach((alert) => alerts.push(alert));
    });

    return alerts;
};

export const getBehaviorAlertTargetTime = (alert: BehaviorAlert) => new Date(alert.timestamp).getTime();
export const getLatestBehaviorSample = latestValidPoint;
