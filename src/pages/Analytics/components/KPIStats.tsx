import React from 'react';
import { Activity, Battery, Thermometer, Zap, MapPin, LucideIcon } from 'lucide-react';

interface KPIs {
  avgBattery: number;
  avgTemp: number;
  mostActiveId: string | number;
  totalPoints: number;
}

interface KPIStatsProps {
  kpis: KPIs;
  prediction: number | null;
}

interface StatItem {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const KPIStats = ({ kpis, prediction }: KPIStatsProps) => {
  const stats: StatItem[] = [
    {
      label: 'Batterie Moyenne',
      value: `${kpis.avgBattery}%`,
      icon: Battery,
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    {
      label: 'Temp. Moyenne',
      value: `${kpis.avgTemp}°C`,
      icon: Thermometer,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    },
    {
      label: 'Animal le plus actif',
      value: `#${kpis.mostActiveId}`,
      icon: Activity,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    {
      label: 'Points collectés',
      value: kpis.totalPoints.toLocaleString(),
      icon: MapPin,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
      {stats.map((stat, i) => (
        <div key={stat.label} className="glass p-5 rounded-2xl border border-white/20 dark:border-slate-800/50 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
          <div>
            <p className="label-xs mb-1">{stat.label}</p>
            <p className="title-lg text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
            <stat.icon className="w-6 h-6" />
          </div>
        </div>
      ))}
      
      {/* Battery Prediction Summary */}
      {prediction !== null && (
        <div className="md:col-span-2 lg:col-span-4 glass p-6 rounded-2xl border-2 border-primary/20 bg-primary/5 dark:bg-emerald-500/5 mt-2 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary animate-pulse">
              <Zap className="w-7 h-7" />
            </div>
            <div>
              <h4 className="title-md text-slate-900 dark:text-white leading-none">Analyse prédictive de batterie</h4>
              <p className="label-xs mt-1">Régression linéaire sur les dernières 72 heures</p>
            </div>
          </div>
          <div className="text-center md:text-right">
            <p className="label-xs">Statut estimé</p>
            <p className="title-lg text-slate-900 dark:text-white tracking-tighter">
              {prediction < 0 ? (
                <span className="text-primary">Solaire / Stable</span>
              ) : (
                <>Critique dans <span className="text-alert-high value-xl">{prediction}</span> jours</>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIStats;
