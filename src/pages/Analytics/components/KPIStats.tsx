import { Activity, Gauge, Thermometer, MapPin, LucideIcon } from 'lucide-react';
import { DataBadge } from '../../../components/ui/DataBadge';

interface KPIs {
  avgMovement: number;
  avgTemp: number;
  mostActiveId: string | number;
  totalPoints: number;
}

interface KPIStatsProps {
  kpis: KPIs;
  prediction?: number | null;
}

interface StatItem {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  source: 'live' | 'fallback' | 'derived' | 'simulated';
}

const KPIStats = ({ kpis }: KPIStatsProps) => {
  const stats: StatItem[] = [
    {
      label: 'Mouvement Moyen',
      value: kpis.avgMovement > 0 ? `${kpis.avgMovement.toFixed(2)} g` : 'N/A',
      icon: Gauge,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      source: 'live'
    },
    {
      label: 'Temp. Moyenne',
      value: kpis.avgTemp > 0 ? `${kpis.avgTemp}°C` : 'N/A',
      icon: Thermometer,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      source: 'live'
    },
    {
      label: 'Collier le plus actif',
      value: kpis.mostActiveId !== 'N/A' ? `#${kpis.mostActiveId}` : 'N/A',
      icon: Activity,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      source: 'derived'
    },
    {
      label: 'Points collectés',
      value: kpis.totalPoints.toLocaleString(),
      icon: MapPin,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
      source: 'derived'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
      {stats.map((stat) => (
        <div key={stat.label} className="glass p-5 rounded-2xl border border-white/20 dark:border-slate-800/50 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="label-xs">{stat.label}</p>
              <DataBadge source={stat.source} />
            </div>
            <p className="title-lg text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
            <stat.icon className="w-6 h-6" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default KPIStats;
