import { IAnimal } from '../types';

export type HealthLabel = 'excellent' | 'bon' | 'surveillance' | 'critique';
export type HealthMetricKey = 'battery' | 'temperature' | 'activity' | 'rssi' | 'alerts';

export interface HealthAlertLike {
    collar_id?: string;
    timestamp?: string | number | Date;
    type?: string;
    severity?: string;
}

export interface HealthScoreInput extends Pick<IAnimal, 'battery' | 'temperature' | 'speed' | 'activity_level' | 'rssi'> {
    collar_id?: string;
    alerts?: HealthAlertLike[];
    alertWindowMinutes?: number;
}

export interface HealthMetricScore {
    key: HealthMetricKey;
    label: string;
    score: number;
    weight: number;
}

export interface HealthScoreResult {
    score: number;
    label: HealthLabel;
    mostConcerningMetric: HealthMetricScore;
    recentAlertCount: number;
    breakdown: HealthMetricScore[];
}

const WEIGHTS: Record<HealthMetricKey, number> = {
    battery: 20,
    temperature: 30,
    activity: 25,
    rssi: 15,
    alerts: 10,
};

const LABELS: Record<HealthLabel, string> = {
    excellent: 'Excellent',
    bon: 'Bon',
    surveillance: 'Surveillance',
    critique: 'Critique',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const scoreBattery = (battery?: number) => clamp(Number.isFinite(battery ?? NaN) ? (battery as number) : 0, 0, 100);

const scoreTemperature = (temperature?: number) => {
    const temp = Number.isFinite(temperature ?? NaN) ? (temperature as number) : 0;
    const deviation = Math.abs(temp - 39);
    return clamp(100 - deviation * 25, 0, 100);
};

const scoreActivity = (speed?: number, activityLevel?: number) => {
    const normalizedSpeed = clamp((Number.isFinite(speed ?? NaN) ? (speed as number) : 0) / 8, 0, 1);
    const normalizedActivity = clamp((Number.isFinite(activityLevel ?? NaN) ? (activityLevel as number) : 0) / 4, 0, 1);

    // Activity is a blended signal: both low movement and low activity level should reduce the score.
    return clamp((normalizedActivity * 60) + (normalizedSpeed * 40), 0, 100);
};

const scoreRssi = (rssi?: number) => {
    const value = Number.isFinite(rssi ?? NaN) ? (rssi as number) : -100;
    return clamp(((value + 100) / 60) * 100, 0, 100);
};

const scoreAlerts = (alerts: HealthAlertLike[] | undefined, collarId?: string, windowMinutes = 24 * 60) => {
    if (!alerts || alerts.length === 0 || !collarId) return { score: 100, count: 0 };

    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    const recentCount = alerts.filter((alert) => {
        if (alert.collar_id !== collarId) return false;
        const time = new Date(alert.timestamp ?? 0).getTime();
        return Number.isFinite(time) && time >= cutoff;
    }).length;

    return {
        score: clamp(100 - recentCount * 20, 0, 100),
        count: recentCount,
    };
};

const getLabel = (score: number): HealthLabel => {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'bon';
    if (score >= 50) return 'surveillance';
    return 'critique';
};

export const getHealthLabelText = (label: HealthLabel) => LABELS[label];

export const scoreAnimalHealth = (animal: HealthScoreInput, alerts?: HealthAlertLike[]): HealthScoreResult => {
    const batteryScore = scoreBattery(animal.battery);
    const temperatureScore = scoreTemperature(animal.temperature);
    const activityScore = scoreActivity(animal.speed, animal.activity_level);
    const rssiScore = scoreRssi(animal.rssi);
    const alertWindowMinutes = animal.alertWindowMinutes ?? 24 * 60;
    const alertsScore = scoreAlerts(alerts, animal.collar_id, alertWindowMinutes);

    const breakdown: HealthMetricScore[] = [
        { key: 'battery', label: 'Batterie', score: batteryScore, weight: WEIGHTS.battery },
        { key: 'temperature', label: 'Température', score: temperatureScore, weight: WEIGHTS.temperature },
        { key: 'activity', label: 'Activité / vitesse', score: activityScore, weight: WEIGHTS.activity },
        { key: 'rssi', label: 'Signal RSSI', score: rssiScore, weight: WEIGHTS.rssi },
        { key: 'alerts', label: 'Alertes récentes', score: alertsScore.score, weight: WEIGHTS.alerts },
    ];

    const weightedScore = breakdown.reduce((sum, item) => sum + (item.score * item.weight), 0) / 100;
    const score = Math.round(clamp(weightedScore, 0, 100));
    const label = getLabel(score);
    const mostConcerningMetric = [...breakdown].sort((a, b) => a.score - b.score || b.weight - a.weight)[0];

    return {
        score,
        label,
        mostConcerningMetric,
        recentAlertCount: alertsScore.count,
        breakdown,
    };
};

export const HEALTH_LABEL_COLORS: Record<HealthLabel, string> = {
    excellent: 'text-emerald-600 dark:text-emerald-400',
    bon: 'text-green-600 dark:text-green-400',
    surveillance: 'text-amber-600 dark:text-amber-400',
    critique: 'text-red-600 dark:text-red-400',
};

export const HEALTH_LABEL_BORDERS: Record<HealthLabel, string> = {
    excellent: 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10',
    bon: 'border-green-200 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10',
    surveillance: 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10',
    critique: 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10',
};
