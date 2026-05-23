import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useMqtt } from '../../contexts/MqttContext';
import { useIoTStore } from '../../hooks/useIoTStore';
import { useMapWorker } from '../../hooks/useMapWorker';
import {
  Activity, Bell, MapPin, ShieldAlert, Cpu, Battery,
  Radio, TrendingUp, Thermometer, Gauge, Save, RotateCcw
} from 'lucide-react';
import { SkeletonCard, SkeletonChart } from '../../components/ui/Skeleton';
import LiveBadge from '../../components/ui/LiveBadge';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import WeatherWidget from '../../components/widgets/WeatherWidget';
import { IKpis } from '../../types';
import Button from '../../components/ui/Button';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
);

// --- Performance Optimized Constants ---
const DEFAULT_LAYOUT = ['total', 'active', 'alerts', 'outOfZone'];
const LAYOUT_KEY = 'ss_dashboard_layout_v1';
const CHART_UPDATE_INTERVAL = 5000; // 5 seconds
const MAX_CHART_POINTS = 20; // Limit chart points for performance
const BATTERY_LOW_THRESHOLD = 20;

interface ChartData {
  labels: string[];
  animals: number[];
  alerts: number[];
}

export default function Dashboard() {
  const { isConnected, isSimulation, toggleSimulation } = useMqtt();
  const positions = useIoTStore(state => state.devices);
  const history = useIoTStore(state => state.history);
  const alerts = useIoTStore(state => state.alerts);
  const { enrichedAnimals: animalsList, kpis } = useMapWorker(positions, history, []);
  const markAlertAsRead = useIoTStore(state => state.markAlertAsRead);
  const isOfflineData = useIoTStore(state => state.isOfflineData);

  // Performance refs
  const chartUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const renderCountRef = useRef<number>(0);

  const [isLoaded, setIsLoaded] = useState(false);
  const [historicData, setHistoricData] = useState<ChartData>({
    labels: [],
    animals: [],
    alerts: []
  });
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [isChartPaused, setIsChartPaused] = useState(false);

  // Memoized calculations to prevent unnecessary re-renders
  const criticalAlerts = useMemo(() => 
    alerts.filter(a => a.severity === 'CRITICAL' && !a.read), 
    [alerts]
  );

  const lowBatteryDevices = useMemo(() => 
    Object.values(positions).filter(d => d.battery <= BATTERY_LOW_THRESHOLD),
    [positions]
  );

  const unreadCount = useMemo(() => 
    alerts.filter(a => !a.read).length,
    [alerts]
  );

  // Optimized chart update function
  const updateChartData = useCallback(() => {
    if (isChartPaused) return;

    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    setHistoricData(prev => {
      const newLabels = [...prev.labels, timeLabel].slice(-MAX_CHART_POINTS);
      const newAnimals = [...prev.animals, animalsList.length].slice(-MAX_CHART_POINTS);
      const newAlerts = [...prev.alerts, unreadCount].slice(-MAX_CHART_POINTS);
      
      return {
        labels: newLabels,
        animals: newAnimals,
        alerts: newAlerts
      };
    });

    lastUpdateRef.current = Date.now();
  }, [isChartPaused, animalsList.length, unreadCount]);

  // Load layout once with error handling
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved) {
        const parsedLayout = JSON.parse(saved);
        if (Array.isArray(parsedLayout) && parsedLayout.length > 0) {
          setLayout(parsedLayout);
        }
      }
    } catch (error) {
      console.warn('Failed to load layout from localStorage:', error);
      setLayout(DEFAULT_LAYOUT);
    }
  }, []);

  // Initialize chart data efficiently
  useEffect(() => {
    const now = new Date();
    const initialData: ChartData = {
      labels: Array(MAX_CHART_POINTS).fill(0).map((_, i) => {
        const d = new Date(now.getTime() - (MAX_CHART_POINTS - 1 - i) * CHART_UPDATE_INTERVAL);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }),
      animals: Array(MAX_CHART_POINTS).fill(animalsList.length),
      alerts: Array(MAX_CHART_POINTS).fill(unreadCount)
    };
    setHistoricData(initialData);
  }, []); // Only run once on mount

  // Optimized chart update interval with visibility handling
  useEffect(() => {
    if (!isLoaded) return;

    // Clear existing interval
    if (chartUpdateRef.current) {
      clearInterval(chartUpdateRef.current);
      chartUpdateRef.current = null;
    }

    // Set new interval
    chartUpdateRef.current = setInterval(() => {
      // Throttle updates if tab is not visible
      if (!document.hidden) {
        updateChartData();
      }
    }, CHART_UPDATE_INTERVAL);

    return () => {
      if (chartUpdateRef.current) {
        clearInterval(chartUpdateRef.current);
        chartUpdateRef.current = null;
      }
    };
  }, [isLoaded, updateChartData]);

  // Handle visibility change to pause/resume updates
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsChartPaused(document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Track render performance
  useEffect(() => {
    renderCountRef.current += 1;
    if (renderCountRef.current % 100 === 0) {
      console.warn(`Dashboard rendered ${renderCountRef.current} times - check for performance issues`);
    }
  });

  // Simulate initial loading with performance tracking
  useEffect(() => {
    const startTime = performance.now();
    const timer = setTimeout(() => {
      const loadTime = performance.now() - startTime;
      console.log(`Dashboard loaded in ${loadTime.toFixed(2)}ms`);
      setIsLoaded(true);
      renderCountRef.current = 0;
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Memoized chart data to prevent unnecessary re-renders
  const chartData = useMemo(() => ({
    labels: historicData.labels,
    datasets: [
      {
        label: 'Troupeau Actif',
        data: historicData.animals,
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22, 163, 74, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        yAxisID: 'y',
      },
      {
        label: 'Niveau Alertes',
        data: historicData.alerts,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        fill: true,
        tension: 0.4,
        borderWidth: 1.5,
        pointRadius: 0,
        borderDash: [5, 5],
        yAxisID: 'y1',
      },
    ],
  }), [historicData]);

  // Memoized chart options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    animation: {
      duration: isChartPaused ? 0 : 300, // Disable animations when paused
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        padding: 12,
        cornerRadius: 12,
        titleFont: { weight: 'bold' as const, size: 12 },
        bodyFont: { size: 11 },
      }
    },
    scales: {
      y: {
        display: false,
        position: 'left' as const,
      },
      y1: {
        display: false,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
      },
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 9, weight: '700' as const },
          color: '#9ca3af',
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6
        }
      }
    }
  }), [isChartPaused]);

  if (!isLoaded) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-0">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-gray-100 dark:bg-gray-800/50 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><SkeletonChart /></div>
          <div className="hidden lg:block"><SkeletonChart /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in p-4 md:p-0">
      {/* SaaS Styled Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="title-lg text-gray-900 dark:text-white tracking-tight">Tableau de bord intelligent</h1>
          <p className="body-md text-gray-500 dark:text-gray-400">
            Monitoring industriel de l'exploitation.
            {renderCountRef.current > 50 && (
              <span className="ml-2 text-amber-500">⚠️ Performance mode</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsChartPaused(!isChartPaused)}
            variant={isChartPaused ? 'secondary' : 'ghost'}
            className="px-3 py-2 rounded-xl label-xs"
          >
            {isChartPaused ? '▶️' : '⏸️'} {isChartPaused ? 'Reprendre' : 'Pause'}
          </Button>

          <Button
            onClick={toggleSimulation}
            variant={isSimulation ? 'primary' : 'secondary'}
            className={`px-4 py-2 rounded-xl label-xs transition-all flex items-center gap-2 border ${isSimulation
              ? 'bg-primary/10 border-primary/20 text-primary animate-pulse'
              : 'bg-white dark:bg-card-dark border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
              }`}
          >
            <Radio className="w-3.5 h-3.5" />
            {isSimulation ? 'Simulation' : 'Temps réel'}
          </Button>

          <div className="flex items-center gap-2 bg-white dark:bg-card-dark px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <LiveBadge isConnected={isConnected} isOfflineData={isOfflineData} />
            <span className="label-xs">
              {isConnected ? 'MQTT connecté' : isOfflineData ? 'Mode hors-ligne' : 'Passerelle hors-ligne'}
            </span>
          </div>
        </div>
      </header>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="font-semibold text-red-800 dark:text-red-200">
              {criticalAlerts.length} alerte{criticalAlerts.length > 1 ? 's' : ''} critique{criticalAlerts.length > 1 ? 's' : ''} nécessite{criticalAlerts.length > 1 ? 'nt' : ''} votre attention
            </span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <aside className="lg:col-span-1">
          <WeatherWidget />
        </aside>

        <section className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {layout.map((id) => (
            <React.Fragment key={id}>
              {id === 'total' && (
                <KpiCard
                  title="Total troupeau"
                  value={animalsList.length}
                  icon={<Activity />}
                  color="blue"
                  trend={animalsList.length > 0 ? `${animalsList.length} colliers actifs` : 'En attente...'}
                  live
                />
              )}
              {id === 'active' && (
                <KpiCard
                  title="En ligne"
                  value={kpis.totalActive}
                  icon={<Cpu />}
                  color="green"
                  live
                />
              )}
              {id === 'alerts' && (
                <KpiCard
                  title="Alertes"
                  value={unreadCount}
                  icon={<Bell />}
                  color="amber"
                  isAlert={unreadCount > 0}
                  trend={`${criticalAlerts.length} critiques`}
                />
              )}
              {id === 'outOfZone' && (
                <KpiCard
                  title="Hors Zone"
                  value={kpis.outOfZone}
                  icon={<ShieldAlert />}
                  color="red"
                  isAlert={kpis.outOfZone > 0}
                />
              )}
            </React.Fragment>
          ))}
        </section>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <MiniKpi
          icon={<Battery className="text-amber-500" />}
          label="Niveau batterie"
          value={`${kpis.avgBattery}%`}
          sub={`${lowBatteryDevices.length} critiques (<${BATTERY_LOW_THRESHOLD}%)`}
          isAlert={lowBatteryDevices.length > 0}
        />
        <MiniKpi
          icon={<Thermometer className="text-orange-500" />}
          label="Santé troupeau"
          value={animalsList.length > 0 ? "38.5°C" : "—"}
          sub="Température moyenne"
        />
        <MiniKpi
          icon={<Gauge className="text-blue-500" />}
          label="Charge ingestion"
          value={historicData?.animals?.length > 0
            ? `${((historicData.animals[historicData.animals.length - 1] || 0) / 2).toFixed(0)}%`
            : "0%"}
          sub="Flux de télémétrie"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="title-sm text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Métriques d'activité
            </h3>
            <div className="flex items-center gap-2">
              <span className="label-xs">
                {isChartPaused ? 'En pause' : 'Mise à jour automatique'}
              </span>
            </div>
          </div>
          <div className="h-[300px]">
            {chartData && chartData.labels?.length > 0 ? (
              <Line options={chartOptions} data={chartData} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">Initialisation du flux...</div>
            )}
          </div>
        </div>

        {/* Alerts Feed */}
        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="title-sm text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" /> Flux d'alertes
            </h3>
            <span className="bg-amber-100 dark:bg-amber-500/10 text-amber-600 label-xs px-2 py-0.5 rounded-full">
              {unreadCount} nouvelles
            </span>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar flex-1">
            {alerts.length === 0 ? (
              <EmptyAlerts />
            ) : (
              alerts.slice(0, 10).map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onRead={markAlertAsRead}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Optimized Sub-components ---

interface KpiCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  isAlert?: boolean;
  live?: boolean;
}

function KpiCard({ title, value, icon, color, trend, isAlert, live }: KpiCardProps) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50/50 dark:bg-blue-500/5 text-blue-600',
    green: 'bg-green-50/50 dark:bg-green-500/5 text-green-600',
    amber: 'bg-amber-50/50 dark:bg-amber-500/5 text-amber-600',
    red: 'bg-red-50/50 dark:bg-red-500/5 text-red-600',
  };

  return (
    <div className={`bg-white dark:bg-card-dark p-4 md:p-5 rounded-2xl shadow-sm border transition-all ${isAlert ? 'border-red-200 dark:border-red-500/30 ring-2 ring-red-500/10' : 'border-gray-100 dark:border-gray-800'
      }`}>
      <div className="flex justify-between items-start mb-4">
        <p className="label-xs">{title}</p>
        <div className={`p-2.5 rounded-xl ${colors[color] || 'bg-gray-50'}`}>
          {React.cloneElement(icon as React.ReactElement, { size: 18 })}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <h4 className="value-xl text-gray-900 dark:text-white tabular-nums">{value}</h4>
        {live && <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
      </div>
      {trend && (
        <p className={`label-xs mt-2 ${isAlert ? 'text-red-500' : ''}`}>
          {trend}
        </p>
      )}
    </div>
  );
}

interface MiniKpiProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  isAlert?: boolean;
}

function MiniKpi({ icon, label, value, sub, isAlert }: MiniKpiProps) {
  return (
    <div className={`bg-white dark:bg-card-dark p-4 rounded-2xl border transition-all flex items-center gap-4 ${isAlert ? 'border-amber-200 dark:border-amber-500/30' : 'border-gray-100 dark:border-gray-800'
      }`}>
      <div className={`p-2.5 rounded-xl ${isAlert ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
        {React.cloneElement(icon as React.ReactElement, { size: 16 })}
      </div>
      <div className="min-w-0">
        <p className="label-xs">{label}</p>
        <p className="title-md text-gray-900 dark:text-white truncate">{value}</p>
        <p className="label-xs truncate">{sub}</p>
      </div>
    </div>
  );
}

interface AlertItemProps {
  alert: any;
  onRead: (id: string | number) => void;
}

function AlertItem({ alert, onRead }: AlertItemProps) {
  return (
    <div
      className={`p-3 rounded-xl border transition-all flex gap-3 cursor-pointer group ${alert.read
        ? 'bg-gray-50/50 dark:bg-gray-800/20 border-gray-100 dark:border-gray-800 opacity-60'
        : 'bg-white dark:bg-card-dark border-gray-100 dark:border-gray-800 hover:border-primary/30'
        }`}
      onClick={() => onRead(alert.id)}
    >
      <div className={`p-2 rounded-lg flex-shrink-0 self-center ${alert.severity === 'CRITICAL' ? 'bg-red-50 dark:bg-red-500/10 text-red-600' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'
        }`}>
        <ShieldAlert size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-0.5">
          <p className="title-sm text-gray-900 dark:text-white truncate">{alert.animal_name}</p>
          <span className="label-xs">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p className="label-xs truncate">
          {alert.type.replace('_', ' ').toLowerCase()}
        </p>
      </div>
      {!alert.read && <div className="w-1.5 h-1.5 rounded-full bg-primary self-center" />}
    </div>
  );
}

function EmptyAlerts() {
  return (
    <div className="text-center py-12 flex flex-col items-center">
      <div className="w-12 h-12 bg-green-50 dark:bg-green-500/5 rounded-full flex items-center justify-center mb-4">
        <ShieldAlert className="text-green-500/50" size={24} />
      </div>
      <p className="label-sm font-black text-gray-400">Opérations nominales</p>
      <p className="label-xs mt-1">Aucune alerte active à signaler.</p>
    </div>
  );
}
