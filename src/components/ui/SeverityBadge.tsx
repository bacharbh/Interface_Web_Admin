import React from 'react';

interface SeverityBadgeProps {
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const colors = {
  low: { classes: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300', label: 'Faible' },
  medium: { classes: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', label: 'Moyen' },
  high: { classes: 'bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300', label: 'Eleve' },
  critical: { classes: 'bg-red-500 text-white', label: 'Critique' },
};

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const config = colors[severity] || colors.low;

  return (
    <span className={`inline-flex items-center justify-center text-[11px] px-2 py-[3px] rounded-full font-medium leading-none ${config.classes}`}>
      {config.label}
    </span>
  );
};

export default SeverityBadge;
