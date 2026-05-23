import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMqtt } from '../../contexts/MqttContext';
import { useIoTStore } from '../../hooks/useIoTStore';
import { useMapWorker } from '../../hooks/useMapWorker';
import {
  Activity, Bell, ShieldAlert, Cpu, Battery,
  Radio, TrendingUp, Thermometer, Gauge, AlertTriangle
} from 'lucide-react';
import { SkeletonCard, SkeletonChart } from '../../components/ui/Skeleton';
import LiveBadge from '../../components/ui/LiveBadge';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import WeatherWidget from '../../components/widgets/WeatherWidget';
import AtRiskAnimals from '../../components/widgets/AtRiskAnimals';
import AlertRow from '../../components/ui/AlertRow';
import { IKpis } from '../../types';
import Button from '../../components/ui/Button';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
);

// --- Simple Layout Persistence Logic ---
const DEFAULT_LAYOUT = ['total', 'active', 'alerts', 'outOfZone'];
const LAYOUT_KEY = 'ss_dashboard_layout_v1';

// --- Optimized Chart Component ---
const MemoizedChart = React.memo(
  ({ chartData, options }: any) => {
    return <Line options={options} data={chartData} />;
  },
  (prevProps, nextProps) => {
    // Custom comparator: only re-render if the last time label changed
    const prevLabels = prevProps.chartData?.labels;
    const nextLabels = nextProps.chartData?.labels;
    if (!prevLabels || !nextLabels || prevLabels.length !== nextLabels.length) return false;
    return prevLabels[prevLabels.length - 1] === nextLabels[nextLabels.length - 1];
  }
);

export default function Dashboard() {
  const navigate = useNavigate();
  const { isConnected, isSimulation, toggleSimulation } = useMqtt();
  const positions = useIoTStore(state => state.devices);
  const history = useIoTStore(state => state.history);
  const alerts = useIoTStore(state => state.alerts);
  const { enrichedAnimals: animalsList, kpis } = useMapWorker(positions, history, []);
  const markAlertAsRead = useIoTStore(state => state.markAlertAsRead);
  const isOfflineData = useIoTStore(state => state.isOfflineData);
  const isDev = import.meta.env.DEV;

  // Adapt IAnimal[] → AtRiskAnimals Animal[] shape
  const atRiskAnimalList = useMemo(() =>
    animalsList.map((a) => ({
      id: a.collar_id ?? a.sheepId ?? String(a.id ?? Math.random()),
      name: a.name,
      breed: a.breed,
      battery: a.battery,
      temp: a.temperature,
      status: a.status,
      geofence_exit: a.status === 'OUT_OF_ZONE',
      inactivity_hours: a.activity_level != null && a.activity_level < 0.1 ? 3 : 0,
    })),
    [animalsList]
  );

  const [isLoaded, setIsLoaded] = useState(false);
  const [historicData, setHistoricData] = useState<{ labels: string[], animals: number[], alerts: number[] }>({
    labels: [],
    animals: [],
    alerts: []
  });
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);

  // Optimizations refs
  const chartUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);
  const latestDataRef = useRef({ animals: animalsList.length, alerts: alerts.length });

  // Memoized calculations
  const unreadCount = useMemo(() => alerts.filter(a => !a.read).length, [alerts]);
  const criticalAlertsCount = useMemo(() => alerts.filter(a => a.severity === 'CRITICAL').length, [alerts]);

  const avgTemperature = useMemo(() => {
    const devices = Object.values(positions);
    const validTemps = devices
      .map(d => d.temperature)
      .filter((t): t is number => typeof t === 'number' && !isNaN(t));

    if (validTemps.length === 0) return 'N/A';
    const sum = validTemps.reduce((acc, t) => acc + t, 0);
    return (sum / validTemps.length).toFixed(1) + '°C';
  }, [positions]);

  const avgBatteryValue = useMemo(() => {
    const devices = Object.values(positions);
    const validBatteries = devices
      .map(d => d.battery)
      .filter((b): b is number => typeof b === 'number' && !isNaN(b));

    if (validBatteries.length === 0) return 'N/A';
    const sum = validBatteries.reduce((acc, b) => acc + b, 0);
    return (sum / validBatteries.length).toFixed(0) + '%';
  }, [positions]);

  // Keep latest data for the interval without triggering re-renders
  useEffect(() => {
    latestDataRef.current = { animals: animalsList.length, alerts: alerts.length };
  }, [animalsList.length, alerts.length]);

  // Handle visibility change to pause updates when tab is in background
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Load layout once
  useEffect(() => {
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (saved) {
      try {
        setLayout(JSON.parse(saved));
      } catch {
        setLayout(DEFAULT_LAYOUT);
      }
    }
  }, []);

  // Initialize the chart
  useEffect(() => {
    const now = new Date();
    setHistoricData({
      labels: Array(12).fill(0).map((_, i) => {
        const d = new Date(now.getTime() - (11 - i) * 5000);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }),
      animals: Array(12).fill(latestDataRef.current.animals),
      alerts: Array(12).fill(latestDataRef.current.alerts)
    });
  }, []);

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Optimized, throttled callback for updating chart data
  const updateChartData = useCallback(() => {
    if (!isVisibleRef.current) return;

    const now = Date.now();
    // Throttling: skip update if the last update was less than 4 seconds ago
    if (now - lastUpdateRef.current < 4000) return;
    lastUpdateRef.current = now;

    const timeLabel = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setHistoricData(prev => ({
      labels: [...prev.labels.slice(-11), timeLabel],
      animals: [...prev.animals.slice(-11), latestDataRef.current.animals],
      alerts: [...prev.alerts.slice(-11), latestDataRef.current.alerts]
    }));
  }, []);

  // Real-time Data Capture using setInterval with cleanup
  useEffect(() => {
    if (!isLoaded) return;

    chartUpdateRef.current = setInterval(updateChartData, 5000);

    return () => {
      if (chartUpdateRef.current) {
        clearInterval(chartUpdateRef.current);
      }
    };
  }, [isLoaded, updateChartData]);

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

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-0">
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
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in p-4 md:p-0">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Vue d'ensemble</p>
          <h1 className="mt-1 text-[24px] font-medium leading-tight text-[var(--text-primary)]">Tableau de bord intelligent</h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Monitoring agricole sobre, lisible et centré sur l'essentiel.</p>
        </div>

        {isDev && (
          <Button
            onClick={toggleSimulation}
            variant={isSimulation ? 'primary' : 'secondary'}
            className={`inline-flex items-center gap-2 px-4 py-2 text-[12px] ${isSimulation
              ? 'border border-[var(--brand-primary)] bg-[var(--brand-light)] text-[var(--brand-dark)]'
              : 'border border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:border-[#c8dfd6]'
              }`}
          >
            <Radio className="h-3.5 w-3.5" />
            {isSimulation ? 'Simulation' : 'Temps réel'}
          </Button>
        )}
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        <aside className="lg:col-span-1">
          <WeatherWidget />
        </aside>

        <section className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {layout.map((id) => (
            <React.Fragment key={id}>
              {id === 'total' && (
                <KpiCard
                  title="Total"
                  value={animalsList.length}
                  icon={<Activity />}
                  color="blue"
                  trend={animalsList.length > 0 ? `${animalsList.length} actifs` : 'Attente...'}
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
                  trend={`${criticalAlertsCount} critiques`}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-6">
        <MiniKpi
          icon={<Battery className="text-amber-500" />}
          label="Batterie"
          value={avgBatteryValue}
          sub={`${kpis.lowBattery} critiques`}
        />
        <MiniKpi
          icon={<Thermometer className="text-orange-500" />}
          label="Santé"
          value={avgTemperature}
          sub="Temp. moy."
        />
        <MiniKpi
          icon={<Gauge className="text-blue-500" />}
          label="Charge"
          value={historicData?.animals?.length > 0
            ? `${((historicData.animals[historicData.animals.length - 1] || 0) / 2).toFixed(0)}%`
            : "0%"}
          sub="Télémétrie"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Activity Chart */}
        <div className="flex flex-col rounded-[10px] border border-[var(--card-border)] bg-white p-4 md:p-6 dark:bg-[var(--card-bg)]">
          <div className="mb-6 flex items-center justify-between md:mb-8">
            <h3 className="flex items-center gap-2 text-[14px] font-medium text-[var(--text-primary)]">
              <TrendingUp className="h-4 w-4 text-[var(--brand-primary)]" /> Activité
            </h3>
            <span className="text-[11px] text-[var(--text-muted)]">Mise à jour auto</span>
          </div>
          <div className="h-[200px] md:h-[300px]">
            {chartData && chartData.labels?.length > 0 ? (
              <MemoizedChart options={{ ...chartOptions, maintainAspectRatio: false }} chartData={chartData} />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--text-muted)]">Initialisation...</div>
            )}
          </div>
        </div>

        {/* Alerts Feed */}
        <div className="flex flex-col rounded-[10px] border border-[var(--card-border)] bg-white p-0 dark:bg-[var(--card-bg)]">
          <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3 md:px-5">
            <h3 className="flex items-center gap-2 text-[14px] font-medium text-[var(--text-primary)]">
              <Bell className="h-4 w-4 text-[var(--warning)]" /> Flux d'alertes
            </h3>
            <span className="text-[11px] text-[var(--text-muted)]">
              {unreadCount} nouvelles
            </span>
          </div>

          <div className="flex-1 space-y-0 overflow-y-auto max-h-[400px]">
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

      {/* ── At-Risk Animals Priority List ── */}
      <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-800">
          <h3 className="title-sm text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Animaux à risque
          </h3>
          <div className="flex items-center gap-2">
            {atRiskAnimalList.filter(a =>
              (a.battery ?? 100) < 15 ||
              (a.temp ?? 38) > 39.5 ||
              a.geofence_exit ||
              (a.inactivity_hours ?? 0) > 2
            ).length > 0 && (
                <span className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 label-xs px-2.5 py-0.5 rounded-full border border-red-100 dark:border-red-500/20 font-semibold">
                  {atRiskAnimalList.filter(a =>
                    (a.battery ?? 100) < 15 ||
                    (a.temp ?? 38) > 39.5 ||
                    a.geofence_exit ||
                    (a.inactivity_hours ?? 0) > 2
                  ).length} alertes
                </span>
              )}
            <button
              onClick={() => navigate('/map')}
              className="label-xs text-primary hover:underline cursor-pointer"
            >
              Voir carte →
            </button>
          </div>
        </div>

        {/* Widget (no card wrapper — already inside one) */}
        <AtRiskAnimals
          animals={atRiskAnimalList}
          onViewProfile={(id) => navigate(`/animals/${id}`)}
          maxItems={5}
          isLoading={!isLoaded}
        />
      </div>
    </div>
  );
}

// --- Sub-components ---

function KpiCard({ title, value, icon, color, trend, isAlert, live }: any) {
  const colors: Record<string, string> = {
    blue: 'bg-[#eaf2ff] text-[#2050a8]',
    green: 'bg-[var(--success-bg)] text-[var(--success)]',
    amber: 'bg-[var(--warning-bg)] text-[var(--warning)]',
    red: 'bg-[var(--danger-bg)] text-[var(--danger)]',
  };

  return (
    <div className={`rounded-[10px] border bg-white p-4 transition-colors dark:bg-[var(--card-bg)] ${isAlert ? 'border-[var(--danger)]' : 'border-[var(--card-border)] hover:border-[#c8dfd6]'
      }`}>
      <div className="mb-4 flex items-start justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">{title}</p>
        <div className={`rounded-[8px] border border-[var(--card-border)] p-2 ${colors[color] || 'bg-[var(--brand-light)] text-[var(--brand-dark)]'}`}>
          {React.cloneElement(icon as React.ReactElement, { size: 18 })}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <h4 className="text-[28px] font-medium leading-none tabular-nums text-[var(--text-primary)]">{value}</h4>
        {live && <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
      </div>
      {trend && (
        <p className={`mt-2 text-[11px] text-[var(--text-muted)] ${isAlert ? 'text-[var(--danger)]' : ''}`}>
          {trend}
        </p>
      )}
    </div>
  );
}

function MiniKpi({ icon, label, value, sub }: any) {
  return (
    <div className="flex items-center gap-4 rounded-[10px] border border-[var(--card-border)] bg-white p-4 transition-colors dark:bg-[var(--card-bg)]">
      <div className="rounded-[8px] border border-[var(--card-border)] bg-[var(--brand-light)] p-2.5 text-[var(--brand-dark)]">
        {React.cloneElement(icon as React.ReactElement, { size: 16 })}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.05em] text-[var(--text-muted)]">{label}</p>
        <p className="truncate text-[16px] font-medium text-[var(--text-primary)]">{value}</p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">{sub}</p>
      </div>
    </div>
  );
}

function AlertItem({ alert, onRead }: any) {
  const severity = alert.severity === 'CRITICAL' ? 'critical' : alert.severity === 'WARNING' ? 'warning' : 'info';
  const detail = alert.message || `${alert.type.replace(/_/g, ' ').toLowerCase()}.`;

  return (
    <AlertRow
      animal={alert.animal_name}
      detail={detail}
      time={new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      severity={severity}
      unread={!alert.read}
      onClick={() => onRead(alert.id)}
    />
  );
}

function EmptyAlerts() {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[10px] border border-[var(--card-border)] bg-[var(--success-bg)] text-[var(--success)]">
        <ShieldAlert size={22} />
      </div>
      <p className="text-[12px] font-medium text-[var(--text-primary)]">Opérations nominales</p>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">Aucune alerte active à signaler.</p>
    </div>
  );
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111827',
      padding: 12,
      cornerRadius: 12,
      titleFont: { weight: '900', size: 12 },
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
        font: { size: 9, weight: '700' },
        color: '#9ca3af',
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 6
      }
    }
  }
};
