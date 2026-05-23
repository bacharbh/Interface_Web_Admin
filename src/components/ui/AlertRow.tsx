import React from 'react';
import { AlertTriangle, ShieldAlert, Activity } from 'lucide-react';

export interface AlertRowProps {
    animal: string;
    detail: string;
    time: string;
    severity: 'critical' | 'warning' | 'info';
    unread?: boolean;
    onClick?: () => void;
}

const ICONS: Record<AlertRowProps['severity'], React.ReactNode> = {
    critical: <ShieldAlert className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    info: <Activity className="h-4 w-4" />,
};

const AlertRow: React.FC<AlertRowProps> = ({ animal, detail, time, severity, unread, onClick }) => {
    const tone = severity === 'critical'
        ? { bg: 'var(--danger-bg)', fg: 'var(--danger)' }
        : severity === 'warning'
            ? { bg: 'var(--warning-bg)', fg: 'var(--warning)' }
            : { bg: 'var(--brand-light)', fg: 'var(--brand-dark)' };

    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-start gap-3 border-b border-[var(--card-border)] px-4 py-3 text-left transition-colors hover:bg-[#fafaf8] dark:hover:bg-white/3"
        >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[var(--card-border)]" style={{ background: tone.bg, color: tone.fg }}>
                {ICONS[severity]}
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">{animal}</p>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{detail}</p>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2 pt-0.5 text-[10px] text-[var(--text-muted)]">
                <span>{time}</span>
                {unread && <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />}
            </div>
        </button>
    );
};

export default AlertRow;