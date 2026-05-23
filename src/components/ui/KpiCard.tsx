import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

export interface KPICardProps {
    label?: string;
    title?: string;
    value: number | string;
    unit?: string;
    sub?: string;
    trend?: string;
    history?: number[];
    previousValue?: number;
    colorScheme?: 'green' | 'orange' | 'red' | 'blue';
    color?: 'green' | 'orange' | 'red' | 'blue' | 'amber';
    inversePolarity?: boolean;
    icon?: React.ReactNode;
    status?: 'good' | 'warning' | 'danger' | 'neutral';
    live?: boolean;
    isAlert?: boolean;
    timestamp?: string;
}

const COLOR_MAP: Record<'green' | 'orange' | 'red' | 'blue', { accent: string; tint: string }> = {
    green: { accent: '#1D9E75', tint: '#E1F5EE' },
    orange: { accent: '#EF9F27', tint: '#FAEEDA' },
    red: { accent: '#E24B4A', tint: '#FCEBEB' },
    blue: { accent: '#3B82F6', tint: '#EAF2FF' },
};

function useCountUp(target: number, duration = 650) {
    const [display, setDisplay] = useState(0);
    const rafRef = useRef<number>(0);
    const startRef = useRef<number | null>(null);

    useEffect(() => {
        startRef.current = null;

        const animate = (ts: number) => {
            if (startRef.current === null) startRef.current = ts;
            const elapsed = ts - startRef.current;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(target * eased));
            if (progress < 1) rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [target, duration]);

    return display;
}

function Sparkline({ history, stroke }: { history: number[]; stroke: string }) {
    const width = 48;
    const height = 20;

    const path = useMemo(() => {
        if (history.length < 2) return '';

        const min = Math.min(...history);
        const max = Math.max(...history);
        const range = max - min || 1;

        return history
            .map((value, index) => {
                const x = (index / (history.length - 1)) * width;
                const y = height - ((value - min) / range) * (height - 2) - 1;
                return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');
    }, [history]);

    if (!path) return null;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

const KPICard: React.FC<KPICardProps> = (props) => {
    const label = props.label ?? props.title ?? '';
    const schemeKey = props.colorScheme ?? (props.color === 'amber' ? 'orange' : props.color ?? 'green');
    const colorSet = COLOR_MAP[schemeKey as 'green' | 'orange' | 'red' | 'blue'];
    const isLegacy = Boolean(props.title && !props.label);
    const numericValue = typeof props.value === 'number' ? props.value : Number(props.value);
    const hasNumericValue = Number.isFinite(numericValue);
    const animatedValue = useCountUp(hasNumericValue ? numericValue : 0);
    const displayValue = hasNumericValue ? animatedValue : props.value;

    const delta = props.previousValue != null && typeof props.value === 'number'
        ? ((props.value - props.previousValue) / Math.max(props.previousValue, 1)) * 100
        : null;
    const deltaPositive = delta != null ? delta > 0 : false;
    const trendColor = props.status === 'danger' || props.isAlert
        ? 'var(--danger)'
        : props.status === 'warning'
            ? 'var(--warning)'
            : props.status === 'good'
                ? 'var(--success)'
                : colorSet.accent;

    const tint = props.status === 'danger' || props.isAlert
        ? 'var(--danger-bg)'
        : props.status === 'warning'
            ? 'var(--warning-bg)'
            : props.status === 'good'
                ? 'var(--success-bg)'
                : colorSet.tint;

    return (
        <div
            className="group flex h-full flex-col rounded-[10px] border border-[var(--card-border)] bg-white p-4 transition-colors hover:border-[#c8dfd6] dark:bg-[var(--card-bg)]"
            style={isLegacy ? { borderLeftColor: colorSet.accent, borderLeftWidth: 2 } : undefined}
            title={props.timestamp ?? undefined}
        >
            <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    {props.icon && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[var(--card-border)]" style={{ background: tint, color: trendColor }}>
                            {props.icon}
                        </div>
                    )}
                    <p className="truncate text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">{label}</p>
                </div>
                {props.history?.length ? <Sparkline history={props.history} stroke={colorSet.accent} /> : null}
            </div>

            <div className="flex items-end gap-2">
                <span className="text-[28px] font-medium leading-none tabular-nums text-[var(--text-primary)]" style={{ color: props.isAlert ? trendColor : undefined }}>
                    {displayValue as React.ReactNode}
                </span>
                {props.unit && <span className="pb-0.5 text-[12px] text-[var(--text-muted)]">{props.unit}</span>}
                {props.live && <span className="mb-1 h-1.5 w-1.5 rounded-full bg-[var(--success)]" />}
            </div>

            {(props.sub || props.trend || delta != null) && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                    {props.trend ? (
                        <span>{props.trend}</span>
                    ) : delta != null ? (
                        <>
                            {delta === 0 ? null : deltaPositive ? <TrendingUp size={11} color={trendColor} /> : <TrendingDown size={11} color={trendColor} />}
                            <span style={{ color: trendColor }}>{deltaPositive ? '+' : ''}{delta.toFixed(1)}%</span>
                            <span>vs période précédente</span>
                        </>
                    ) : null}
                    {props.sub && <span>{props.sub}</span>}
                </div>
            )}
        </div>
    );
};

export default KPICard;
