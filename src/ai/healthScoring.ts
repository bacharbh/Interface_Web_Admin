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

// Fix 1: donnée absente → 50 (neutre) au lieu de 0 (faux Critique)
const scoreBattery = (battery?: number) => {
    if (!Number.isFinite(battery ?? NaN)) return 50;
    return clamp(battery as number, 0, 100);
};

// Fix 1: température absente → 50 neutre (undefined traitée comme 0°C donnait score 0)
const scoreTemperature = (temperature?: number) => {
    if (!Number.isFinite(temperature ?? NaN)) return 50;
    const deviation = Math.abs((temperature as number) - 39);
    return clamp(100 - deviation * 25, 0, 100);
};

// Fix 2 & 3: courbe en cloche — le repos est normal (~65), le sprint peut indiquer du stress (~60)
// Niveaux d'activité : 0=idle, 1=repos, 2=pâturage, 3=marche, 4=course
// Vitesse optimale : 1–4 km/h (pâturage/marche) ; >6 km/h = possible stress
const scoreActivity = (speed?: number, activityLevel?: number) => {
    const hasSpeed = Number.isFinite(speed ?? NaN);
    const hasActivity = Number.isFinite(activityLevel ?? NaN);

    if (!hasSpeed && !hasActivity) return 50;

    const spd = hasSpeed ? (speed as number) : 0;
    const act = hasActivity ? (activityLevel as number) : 0;

    // act : 0→65, 1→82, 2→100, 3→80, 4→60
    const actScore = act <= 2
        ? clamp(65 + (act / 2) * 35, 65, 100)
        : clamp(100 - ((act - 2) / 2) * 40, 60, 100);

    // spd : 0→65, 4→100, 6→80, 8→60
    const spdScore = spd <= 4
        ? clamp(65 + (spd / 4) * 35, 65, 100)
        : clamp(100 - ((spd - 4) / 4) * 40, 60, 100);

    if (!hasActivity) return spdScore;
    if (!hasSpeed) return actScore;

    return clamp((actScore * 0.6) + (spdScore * 0.4), 0, 100);
};

// Fix 1: RSSI absent → 50 neutre au lieu de -100 dBm (score 0)
const scoreRssi = (rssi?: number) => {
    if (!Number.isFinite(rssi ?? NaN)) return 50;
    return clamp(((rssi as number + 100) / 60) * 100, 0, 100);
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
