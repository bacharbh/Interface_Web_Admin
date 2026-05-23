import { IAnimal } from '../types';

export interface BatteryHistoryPoint extends Pick<IAnimal, 'battery' | 'lastUpdate'> {
    timestamp?: string | number | Date;
}

export interface BatteryProjectionPoint {
    timestamp: string;
    battery: number;
}

export interface BatteryPredictionResult {
    slopePerHour: number;
    hoursTo10: number | null;
    rSquared: number;
    isReliable: boolean;
    recentValues: BatteryProjectionPoint[];
    projectedValues: BatteryProjectionPoint[];
}

const MAX_HISTORY_POINTS = 20;
const DEFAULT_INTERVAL_MS = 60_000;
const PROJECTED_POINTS = 12;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toTimestampMs = (value: BatteryHistoryPoint): number | null => {
    const raw = value.timestamp ?? value.lastUpdate;
    if (!raw) return null;

    const time = new Date(raw).getTime();
    return Number.isFinite(time) ? time : null;
};

const computeLinearRegression = (points: Array<{ x: number; y: number }>) => {
    const count = points.length;
    const sumX = points.reduce((sum, point) => sum + point.x, 0);
    const sumY = points.reduce((sum, point) => sum + point.y, 0);
    const sumXX = points.reduce((sum, point) => sum + (point.x * point.x), 0);
    const sumXY = points.reduce((sum, point) => sum + (point.x * point.y), 0);

    const denominator = (count * sumXX) - (sumX * sumX);
    const slope = denominator === 0 ? 0 : ((count * sumXY) - (sumX * sumY)) / denominator;
    const intercept = count === 0 ? 0 : (sumY - (slope * sumX)) / count;

    const predictedMean = count === 0 ? 0 : sumY / count;
    const totalVariance = points.reduce((sum, point) => sum + Math.pow(point.y - predictedMean, 2), 0);
    const residualVariance = points.reduce((sum, point) => {
        const predicted = slope * point.x + intercept;
        return sum + Math.pow(point.y - predicted, 2);
    }, 0);

    const rSquared = totalVariance === 0 ? 1 : clamp(1 - (residualVariance / totalVariance), 0, 1);

    return { slope, intercept, rSquared };
};

export const predictBatteryDepletion = (history: BatteryHistoryPoint[]): BatteryPredictionResult | null => {
    if (!Array.isArray(history) || history.length === 0) return null;

    const recentHistory = history
        .filter((entry) => Number.isFinite(entry.battery ?? NaN))
        .slice(-MAX_HISTORY_POINTS);

    if (recentHistory.length === 0) return null;

    const hasValidTimestamps = recentHistory.every((entry) => toTimestampMs(entry) !== null);
    const syntheticStart = Date.now() - (recentHistory.length - 1) * DEFAULT_INTERVAL_MS;

    const timeline = recentHistory
        .map((entry, index) => ({
            battery: clamp(entry.battery ?? 0, 0, 100),
            timeMs: hasValidTimestamps ? (toTimestampMs(entry) as number) : syntheticStart + index * DEFAULT_INTERVAL_MS,
        }))
        .sort((left, right) => left.timeMs - right.timeMs);

    const firstTime = timeline[0].timeMs;
    const lastTime = timeline[timeline.length - 1].timeMs;
    const intervalMs = timeline.length > 1
        ? Math.max(DEFAULT_INTERVAL_MS, (lastTime - firstTime) / (timeline.length - 1))
        : DEFAULT_INTERVAL_MS;

    const regressionPoints = timeline.map((point) => ({
        x: (point.timeMs - firstTime) / 3_600_000,
        y: point.battery,
    }));

    const { slope, intercept, rSquared } = computeLinearRegression(regressionPoints);
    const latestX = regressionPoints[regressionPoints.length - 1].x;
    const latestBattery = regressionPoints[regressionPoints.length - 1].y;

    let hoursTo10: number | null = null;
    if (latestBattery <= 10) {
        hoursTo10 = 0;
    } else if (slope < 0) {
        const xAt10 = (10 - intercept) / slope;
        hoursTo10 = Math.max(0, xAt10 - latestX);
    }

    const recentValues = timeline.map((point) => ({
        timestamp: new Date(point.timeMs).toISOString(),
        battery: point.battery,
    }));

    const projectedValues: BatteryProjectionPoint[] = [];
    if (slope < 0) {
        for (let i = 1; i <= PROJECTED_POINTS; i++) {
            const nextTimeMs = lastTime + (i * intervalMs);
            const nextX = (nextTimeMs - firstTime) / 3_600_000;
            const nextBattery = clamp(slope * nextX + intercept, 0, 100);
            projectedValues.push({
                timestamp: new Date(nextTimeMs).toISOString(),
                battery: Math.round(nextBattery),
            });
        }
    }

    return {
        slopePerHour: slope,
        hoursTo10,
        rSquared,
        isReliable: rSquared > 0.7,
        recentValues,
        projectedValues,
    };
};
