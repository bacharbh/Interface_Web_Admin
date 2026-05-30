import React from 'react';

interface LiveBadgeProps {
  isConnected: boolean;
  isSimulation?: boolean;
  isOfflineData?: boolean;
  label?: string;
  className?: string;
}

/**
 * LiveBadge — Professional-grade status indicator.
 * Displays a pulsating dot and a status label.
 */
const LiveBadge: React.FC<LiveBadgeProps> = ({
  isConnected,
  isSimulation = false,
  isOfflineData = false,
  label,
  className = ""
}) => {
  const displayLabel = label || (isSimulation ? 'SIMULATION' : isConnected ? 'EN DIRECT' : isOfflineData ? 'HORS-LIGNE (CACHE)' : 'OFFLINE');
  const color = isSimulation ? '#F59E0B' : isConnected ? '#00A96E' : isOfflineData ? '#F59E0B' : '#EF4444';

  const shouldPulse = Boolean(isSimulation && import.meta.env.DEV);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 dark:bg-[#071422]/60 ${className}`} style={{ border: '1px solid rgba(15,23,42,0.04)' }}>
      <span className="relative inline-flex items-center justify-center" style={{ width: 10, height: 10 }}>
        {shouldPulse && (
          <span className="absolute inline-flex rounded-full" style={{ width: 28, height: 28, backgroundColor: `${color}33`, animation: 'pulse-badge 1.8s ease-in-out infinite' }} />
        )}
        <span className="relative inline-flex rounded-full" style={{ width: 10, height: 10, backgroundColor: color }} />
      </span>
      {displayLabel && (
        <span className="text-[11px] font-bold tracking-wider" style={{ color }}>{displayLabel}</span>
      )}
    </div>
  );
};

export default LiveBadge;
