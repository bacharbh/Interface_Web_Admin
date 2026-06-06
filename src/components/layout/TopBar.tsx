import React from 'react';
import { Bell, Circle, Menu } from 'lucide-react';
import { SearchTriggerButton } from '../ui/GlobalSearch';
import Button from '../ui/Button';

interface TopBarProps {
    title: string;
    subtitle: string;
    unreadCount: number;
    isConnected: boolean;
    isOfflineData: boolean;
    onMenuClick?: () => void;
    onOpenSearch: () => void;
    onOpenAlerts: () => void;
    installAction?: React.ReactNode;
    showMenuButton?: boolean;
    userName?: string;
    roleLabel?: string;
}

function StatusPill({ isConnected, isOfflineData }: Pick<TopBarProps, 'isConnected' | 'isOfflineData'>) {
    const label = isConnected ? 'En direct' : isOfflineData ? 'Hors ligne' : 'Mode API';
    const tone = isConnected ? 'bg-[var(--success-bg)] text-[var(--success)]' : isOfflineData ? 'bg-[var(--warning-bg)] text-[var(--warning)]' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400';

    return (
        <div className={`inline-flex items-center gap-2 rounded-[999px] border border-[var(--card-border)] px-3 py-1.5 text-[11px] font-medium ${tone}`}>
            <Circle className="h-2 w-2 fill-current" />
            <span>{label}</span>
        </div>
    );
}

const TopBar: React.FC<TopBarProps> = ({
    title,
    subtitle,
    unreadCount,
    isConnected,
    isOfflineData,
    onMenuClick,
    onOpenSearch,
    onOpenAlerts,
    installAction,
    showMenuButton = true,
    userName,
    roleLabel,
}) => {
    return (
        <header className="flex h-[50px] items-center gap-3 border-b border-[var(--card-border)] bg-white px-4 md:px-5 dark:bg-[var(--card-bg)]">
            <div className="flex min-w-0 items-center gap-3">
                {showMenuButton && onMenuClick && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="p-2 text-[var(--text-secondary)] md:hidden"
                        onClick={onMenuClick}
                        aria-label="Ouvrir le menu"
                        title="Menu"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                )}

                <div className="min-w-0">
                    <h1 className="truncate text-[14px] font-medium leading-tight text-[var(--text-primary)]">{title}</h1>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">{subtitle}</p>
                </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
                <StatusPill isConnected={isConnected} isOfflineData={isOfflineData} />

                <SearchTriggerButton onClick={onOpenSearch} />

                <Button
                    onClick={onOpenAlerts}
                    variant="ghost"
                    size="sm"
                    className="relative p-2.5 text-[var(--text-secondary)]"
                    aria-label={`Ouvrir les alertes${unreadCount > 0 ? `, ${unreadCount} non lues` : ''}`}
                    title="Alertes"
                >
                    <Bell className={`h-5 w-5 ${unreadCount > 0 ? 'text-[var(--danger)]' : ''}`} />
                    {unreadCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-[28px] min-w-[28px] items-center justify-center rounded-full bg-[var(--danger)] px-1.5 text-[10px] font-medium leading-none text-white animate-[pulse-badge_1.8s_ease-in-out_infinite]">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </Button>

                {installAction}

                {userName && (
                    <div className="hidden items-center gap-2 pl-1 sm:flex">
                        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--card-border)] bg-[var(--brand-light)] text-[11px] font-medium text-[var(--brand-dark)]">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 text-right">
                            <p className="truncate text-[12px] font-medium leading-tight text-[var(--text-primary)]">{userName}</p>
                            {roleLabel && <p className="truncate text-[11px] text-[var(--text-muted)]">{roleLabel}</p>}
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default TopBar;