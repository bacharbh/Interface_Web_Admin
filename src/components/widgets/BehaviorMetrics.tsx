import React, { useMemo } from 'react';
import {
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    XAxis,
} from 'recharts';
import { Activity, Gauge, PieChart as PieChartIcon, Route } from 'lucide-react';

export interface BehaviorMetricsProps {
    avgDistanceKm?: number;
    avgDistanceYesterdayKm?: number;
    grazingHours?: number;
    restingHours?: number;
    ruminationRate?: number;
    ruminationHistory?: number[];
    activityIndex?: number;
    activityHistory?: number[];
    lastUpdated?: Date | null;
}

type TrendDirection = 'up' | 'down' | 'stable';

const SUCCESS_COLOR = 'var(--color-success, #1D9E75)';
const WARNING_COLOR = 'var(--color-warning, #EF9F27)';
const DANGER_COLOR = 'var(--color-danger, #E24B4A)';
const INFO_COLOR = 'var(--color-primary, #3B82F6)';
const SURFACE_BG = 'rgba(15, 23, 42, 0.04)';

const RUMINATION_ZONE_COLORS = [DANGER_COLOR, WARNING_COLOR, SUCCESS_COLOR];

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function isDefinedNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function formatLastUpdated(lastUpdated?: Date | null): string {
    if (!lastUpdated) {
        return 'Mis à jour il y a 0 min';
    }

    const minutes = Math.max(1, Math.round((Date.now() - lastUpdated.getTime()) / 60000));
    return `Mis à jour il y a ${minutes}min`;
}

function getTrend(values: number[]): { direction: TrendDirection; delta: number } {
    if (values.length < 2) {
        return { direction: 'stable', delta: 0 };
    }

    const first = values[0];
    const last = values[values.length - 1];
    const delta = last - first;

    if (Math.abs(delta) < 0.5) {
        return { direction: 'stable', delta };
    }

    return { direction: delta > 0 ? 'up' : 'down', delta };
}

function getArrow(delta: number) {
    if (delta > 0) return '▲';
    if (delta < 0) return '▼';
    return '•';
}

function getTrendColor(direction: TrendDirection) {
    if (direction === 'up') return SUCCESS_COLOR;
    if (direction === 'down') return DANGER_COLOR;
    return 'var(--muted, #6b7280)';
}

function MetricSkeleton() {
    return (
        <div className="w-full rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-card-dark p-4 sm:p-5 shadow-sm animate-pulse">
            <div className="h-4 w-40 rounded-full bg-slate-100 dark:bg-slate-800" />
            <div className="mt-4 h-56 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800" />
        </div>
    );
}

function MetricCard({
    icon,
    title,
    children,
    footer,
}: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <article className="group rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-card-dark p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">{title}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    {icon}
                </div>
            </div>

            <div className="mt-4">{children}</div>

            {footer ? <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">{footer}</div> : null}
        </article>
    );
}

const BehaviorMetrics: React.FC<BehaviorMetricsProps> = ({
    avgDistanceKm,
    avgDistanceYesterdayKm,
    grazingHours,
    restingHours,
    ruminationRate,
    ruminationHistory,
    activityIndex,
    activityHistory,
    lastUpdated,
}) => {
    const hasData = [
        avgDistanceKm,
        avgDistanceYesterdayKm,
        grazingHours,
        restingHours,
        ruminationRate,
        activityIndex,
    ].every(isDefinedNumber);

    const missingHistory =
        !Array.isArray(ruminationHistory) ||
        !Array.isArray(activityHistory) ||
        ruminationHistory.length === 0 ||
        activityHistory.length === 0;

    if (!hasData || !lastUpdated) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MetricSkeleton />
                <MetricSkeleton />
                <MetricSkeleton />
                <MetricSkeleton />
            </div>
        );
    }

    const safeAvgDistanceKm = avgDistanceKm ?? 0;
    const safeAvgDistanceYesterdayKm = avgDistanceYesterdayKm ?? 0;
    const safeGrazingHours = grazingHours ?? 0;
    const safeRestingHours = restingHours ?? 0;
    const safeRuminationRate = ruminationRate ?? 0;
    const safeActivityIndex = activityIndex ?? 0;

    const derived = useMemo(() => {
        const distanceDelta = safeAvgDistanceKm - safeAvgDistanceYesterdayKm;
        const distanceDeltaColor = distanceDelta >= 0 ? SUCCESS_COLOR : DANGER_COLOR;
        const distanceProgress = clamp((safeAvgDistanceKm / 15) * 100, 0, 100);

        const grazingMinutes = safeGrazingHours * 60;
        const restingMinutes = safeRestingHours * 60;
        const totalMinutes = Math.max(1, grazingMinutes + restingMinutes);
        const grazingPct = Math.round((grazingMinutes / totalMinutes) * 100);

        const grazingData = [
            { name: 'Pâturage', value: grazingMinutes },
            { name: 'Repos', value: restingMinutes },
        ];

        const ruminationScore = clamp(safeRuminationRate, 0, 100);
        const ruminationHistoryData = (ruminationHistory ?? []).slice(-7).map((value, index) => ({
            day: index + 1,
            value: clamp(value, 0, 100),
        }));

        const ruminationTrend = getTrend((ruminationHistory ?? []).slice(-7));

        const activityHistoryData = (activityHistory ?? []).slice(-24).map((value, index) => ({
            slot: index + 1,
            value: clamp(value, 0, 100),
        }));

        const activityTrend = getTrend(activityHistoryData.map((point) => point.value));
        const activityColor = getTrendColor(activityTrend.direction);
        const activityDelta = activityHistoryData.length > 1
            ? activityHistoryData[activityHistoryData.length - 1].value - activityHistoryData[0].value
            : 0;

        const ruminationGaugeAngle = 180 - (ruminationScore / 100) * 180;
        const gaugeFillColor =
            ruminationScore >= 65 ? SUCCESS_COLOR : ruminationScore >= 40 ? WARNING_COLOR : DANGER_COLOR;

        return {
            distanceDelta,
            distanceDeltaColor,
            distanceProgress,
            grazingPct,
            grazingData,
            ruminationScore,
            ruminationHistoryData,
            ruminationTrend,
            activityHistoryData,
            activityTrend,
            activityColor,
            activityDelta,
            ruminationGaugeAngle,
            gaugeFillColor,
        };
    }, [activityHistory, safeActivityIndex, safeAvgDistanceKm, safeAvgDistanceYesterdayKm, safeGrazingHours, safeRestingHours, ruminationHistory, safeRuminationRate]);

    const distanceDelta = derived.distanceDelta;
    const distanceDeltaColor = derived.distanceDeltaColor;
    const distanceProgress = derived.distanceProgress;
    const grazingPct = derived.grazingPct;
    const grazingData = derived.grazingData;
    const ruminationScore = derived.ruminationScore;
    const ruminationHistoryData = derived.ruminationHistoryData;
    const ruminationTrend = derived.ruminationTrend;
    const activityHistoryData = derived.activityHistoryData;
    const activityTrend = derived.activityTrend;
    const activityColor = derived.activityColor;
    const activityDelta = derived.activityDelta;
    const ruminationGaugeAngle = derived.ruminationGaugeAngle;
    const gaugeFillColor = derived.gaugeFillColor;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
                icon={<Route className="h-5 w-5" />}
                title="Distance moyenne parcourue"
                footer={formatLastUpdated(lastUpdated)}
            >
                <div className="space-y-4">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                                {safeAvgDistanceKm.toFixed(1)} <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">km</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-sm font-semibold" style={{ color: distanceDeltaColor }}>
                                <span>{getArrow(distanceDelta)}</span>
                                <span>{Math.abs(distanceDelta).toFixed(1)} km vs hier</span>
                            </div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            / 15 km
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${distanceProgress}%`,
                                    background: `linear-gradient(90deg, ${SUCCESS_COLOR}, ${INFO_COLOR})`,
                                }}
                            />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Progression quotidienne du troupeau sur une base de 15 km.
                        </p>
                    </div>
                </div>
            </MetricCard>

            <MetricCard
                icon={<PieChartIcon className="h-5 w-5" />}
                title="Temps Pâturage vs Repos"
                footer="Répartition sur la journée"
            >
                <div className="space-y-4">
                    <div className="relative mx-auto h-[170px] w-full max-w-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={grazingData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={56}
                                    outerRadius={78}
                                    paddingAngle={2}
                                    startAngle={90}
                                    endAngle={-270}
                                    stroke="transparent"
                                >
                                    <Cell fill={SUCCESS_COLOR} />
                                    <Cell fill={INFO_COLOR} />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
                            <div>
                                <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">{grazingPct}%</div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Pâturage</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SUCCESS_COLOR }} />
                            <span>Pâturage</span>
                            <span className="ml-auto text-slate-500 dark:text-slate-400">{safeGrazingHours.toFixed(1)} h</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: INFO_COLOR }} />
                            <span>Repos</span>
                            <span className="ml-auto text-slate-500 dark:text-slate-400">{safeRestingHours.toFixed(1)} h</span>
                        </div>
                    </div>
                </div>
            </MetricCard>

            <MetricCard
                icon={<Gauge className="h-5 w-5" />}
                title="Taux de rumination"
                footer={missingHistory ? 'Historique incomplet' : 'Moyenne sur 7 jours'}
            >
                <div className="space-y-4">
                    <div className="relative mx-auto h-[160px] w-full max-w-[270px] overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Danger', value: 40 },
                                        { name: 'Attention', value: 25 },
                                        { name: 'Optimal', value: 35 },
                                    ]}
                                    dataKey="value"
                                    cx="50%"
                                    cy="90%"
                                    innerRadius={58}
                                    outerRadius={80}
                                    startAngle={180}
                                    endAngle={0}
                                    stroke="transparent"
                                >
                                    {RUMINATION_ZONE_COLORS.map((color) => (
                                        <Cell key={color} fill={color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>

                        <svg className="pointer-events-none absolute inset-0" viewBox="0 0 100 100" aria-hidden="true">
                            <line
                                x1="50"
                                y1="90"
                                x2={50 + Math.cos((Math.PI * ruminationGaugeAngle) / 180) * 28}
                                y2={90 - Math.sin((Math.PI * ruminationGaugeAngle) / 180) * 28}
                                stroke={gaugeFillColor}
                                strokeWidth="1.8"
                                strokeLinecap="round"
                            />
                            <circle cx="50" cy="90" r="2.8" fill={gaugeFillColor} />
                        </svg>

                        <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center">
                            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{ruminationScore.toFixed(0)}%</div>
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Moyenne troupeau</div>
                        </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-slate-100 bg-white/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <span>7 derniers jours</span>
                            <span style={{ color: getTrendColor(ruminationTrend.direction) }}>
                                {getArrow(ruminationTrend.delta)} {Math.abs(ruminationTrend.delta).toFixed(0)} pts
                            </span>
                        </div>
                        <div className="h-14 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={ruminationHistoryData}>
                                    <XAxis dataKey="day" hide />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke={gaugeFillColor}
                                        strokeWidth={2.5}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </MetricCard>

            <MetricCard
                icon={<Activity className="h-5 w-5" />}
                title="Indice d'activité globale"
                footer={formatLastUpdated(lastUpdated)}
            >
                <div className="space-y-4">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <div className="text-4xl font-bold tracking-tight tabular-nums" style={{ color: activityColor }}>
                                {safeActivityIndex.toFixed(0)}
                            </div>
                            <div className="mt-1 text-sm font-semibold" style={{ color: activityColor }}>
                                {getArrow(activityDelta)} {Math.abs(activityDelta).toFixed(0)} pts sur 24h
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                            Tendance {activityTrend.direction === 'stable' ? 'stable' : activityTrend.direction === 'up' ? 'haussière' : 'baissière'}
                        </div>
                    </div>

                    <div className="h-24 rounded-2xl border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-900/60">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={activityHistoryData} margin={{ top: 10, right: 8, left: 8, bottom: 10 }}>
                                <XAxis dataKey="slot" hide />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke={activityColor}
                                    strokeWidth={3}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Indicateur consolidé de comportement global du troupeau.
                    </p>
                </div>
            </MetricCard>
        </div>
    );
};

export default BehaviorMetrics;