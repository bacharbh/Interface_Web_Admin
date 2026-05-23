import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useMqtt } from '../../contexts/MqttContext';
import { useIoTStore, type Alert as IoTAlert } from '../../hooks/useIoTStore';
import { useMapWorker } from '../../hooks/useMapWorker';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Bell, MapPin, ShieldAlert, Cpu, Battery,
  Radio, TrendingUp, Thermometer, Gauge, Save, RotateCcw, GripVertical
} from 'lucide-react';
import { SkeletonCard, SkeletonChart } from '../../components/ui/Skeleton';
import LiveBadge from '../../components/ui/LiveBadge';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler,
  type ChartOptions
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';
import WeatherWidget from '../../components/widgets/WeatherWidget';
import MiniMapPreview from '../../components/widgets/MiniMapPreview';
import geofenceService from '../../services/geofenceService';
import { IKpis, type IGeofenceZone } from '../../types';
import Button from '../../components/ui/Button';

// DND Kit Imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler, annotationPlugin
);

// --- Performance Optimizations ---
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
  const navigate = useNavigate();
  const { isConnected, isSimulation, toggleSimulation } = useMqtt();
  const positions = useIoTStore(state => state.devices);
  const history = useIoTStore(state => state.history);
  const alerts = useIoTStore(state => state.alerts);

  const [zones, setZones] = useState<IGeofenceZone[]>([]);

  useEffect(() => {
    let active = true;
    const fetchZones = async () => {
      try {
        const data = await geofenceService.getZones();
        if (active) {
          setZones(data);
        }
      } catch (error) {
        console.warn("Failed to fetch zones for dashboard.");
      }
    };
    fetchZones();
    return () => {
      active = false;
    };
  }, []);

  const { enrichedAnimals: animalsList, kpis } = useMapWorker(positions, history, zones);
  const markAlertAsRead = useIoTStore(state => state.markAlertAsRead);
  const isOfflineData = useIoTStore(state => state.isOfflineData);

  const mapPreviewAnimals = useMemo(() => {
    return animalsList.map(a => {
      let status: 'normal' | 'warning' | 'alert' = 'normal';
      if (a.status === 'CRITICAL' || a.status === 'OUT_OF_ZONE') {
        status = 'alert';
      } else if (a.status === 'LOW_BATTERY') {
        status = 'warning';
      }
      return {
        id: a.collar_id || a.id,
        lat: a.lat,
        lng: a.lng,
        status
      };
    });
  }, [animalsList]);



  const onlineCount = useMemo(() => {
    const fiveMinutes = 5 * 60 * 1000;
    return animalsList.filter((animal) => {
      const lastSeenValue = (animal as any).lastUpdate ?? (animal as any).lastSeen ?? (animal as any).last_heartbeat;
      const lastSeen = lastSeenValue ? new Date(lastSeenValue).getTime() : NaN;
      return Number.isFinite(lastSeen) && Date.now() - lastSeen < fiveMinutes;
    }).length;
  }, [animalsList]);

  const primaryGeofence = useMemo(() => {
    if (zones.length === 0) return [];
    return zones[0].coords || [];
  }, [zones]);

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
  const latestDataRef = useRef({ animals: 0, alerts: 0 });
  const simulationStartLabel = historicData.labels[historicData.labels.length - 1] ?? null;

  // DND Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Memoized calculations to prevent unnecessary re-renders
  const criticalAlerts = useMemo(() =>
    alerts.filter(a => a.severity === 'CRITICAL' && !a.read),
    [alerts]
  );

  const lowBatteryDevices = useMemo(() =>
    Object.values(positions).filter(d => (d.battery ?? 0) <= BATTERY_LOW_THRESHOLD),
    [positions]
  );

  const unreadCount = useMemo(() =>
    alerts.filter(a => !a.read).length,
    [alerts]
  );

  useEffect(() => {
    latestDataRef.current = { animals: animalsList.length, alerts: unreadCount };
  }, [animalsList.length, unreadCount]);

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
      const newAnimals = [...prev.animals, latestDataRef.current.animals].slice(-MAX_CHART_POINTS);
      const newAlerts = [...prev.alerts, latestDataRef.current.alerts].slice(-MAX_CHART_POINTS);

      return {
        labels: newLabels,
        animals: newAnimals,
        alerts: newAlerts
      };
    });

    lastUpdateRef.current = Date.now();
  }, [isChartPaused]);

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

  const resetLayout = () => {
    localStorage.removeItem(LAYOUT_KEY);
    setLayout(DEFAULT_LAYOUT);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLayout((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newLayout = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(newLayout));
        return newLayout;
      });
    }
  };

  // Initialize chart data efficiently
  useEffect(() => {
    const now = new Date();
    const newLabels = Array(MAX_CHART_POINTS).fill(0).map((_, i) => {
      const d = new Date(now.getTime() - (MAX_CHART_POINTS - 1 - i) * CHART_UPDATE_INTERVAL);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });

    const initialData: ChartData = {
      labels: newLabels,
      animals: Array(MAX_CHART_POINTS).fill(animalsList.length),
      alerts: Array(MAX_CHART_POINTS).fill(unreadCount)
    };
    setHistoricData(initialData);
  }, []); // Only run once on mount

  // Optimized chart update interval
  useEffect(() => {
    if (!isLoaded) return;

    // Clear existing interval
    if (chartUpdateRef.current) {
      clearInterval(chartUpdateRef.current);
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

  // Simulate initial loading with performance tracking
  useEffect(() => {
    const startTime = performance.now();
    const timer = setTimeout(() => {
      const loadTime = performance.now() - startTime;
      if (import.meta.env.DEV && import.meta.env.MODE === 'development') {
        console.log(`Dashboard loaded in ${loadTime.toFixed(2)}ms`);
      }
      setIsLoaded(true);
      renderCountRef.current = 0;
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Track render performance
  useEffect(() => {
    renderCountRef.current += 1;
    if (import.meta.env.DEV && import.meta.env.MODE === 'development' && renderCountRef.current % 100 === 0) {
      console.warn(`Dashboard rendered ${renderCountRef.current} times - check for performance issues`);
    }
  });

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
  const chartOptions = useMemo<ChartOptions<'line'>>(() => {
    const annotationOptions = simulationStartLabel
      ? {
        line1: {
          type: 'line' as const,
          scaleID: 'x',
          value: simulationStartLabel,
          borderColor: '#3b82f6',
          borderWidth: 2,
          borderDash: [5, 5],
          label: {
            display: true,
            content: 'Démarrage simulation',
            position: 'start' as const,
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            color: '#fff',
            font: {
              size: 10,
              weight: 'bold' as const,
            }
          }
        }
      }
      : undefined;

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      animation: {
        duration: isChartPaused ? 0 : 300, // Disable animations when paused
      },
      plugins: {
        legend: { display: false },
        annotation: { annotations: annotationOptions },
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
            font: { size: 9, weight: 'bold' as const },
            color: '#9ca3af',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6
          }
        }
      }
    };
  }, [isChartPaused, simulationStartLabel]);

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
            onClick={resetLayout}
            variant="ghost"
            className="px-3 py-2 rounded-xl label-xs text-gray-400 hover:text-primary transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser l'ordre
          </Button>

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
            {isSimulation && import.meta.env.DEV ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--warning)] animate-pulse" />
                Simulation
              </span>
            ) : 'Temps réel'}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="font-semibold text-red-800 dark:text-red-200">
                {criticalAlerts.length} alerte{criticalAlerts.length > 1 ? 's' : ''} critique{criticalAlerts.length > 1 ? 's' : ''} nécessite{criticalAlerts.length > 1 ? 'nt' : ''} votre attention
              </span>
            </div>
            <Button
              onClick={() => navigate('/alerts?filter=critical')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 border-transparent text-white rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
            >
              Voir les {criticalAlerts.length} alertes &rarr;
            </Button>
          </div>
        </div>
      )}

      {/* Quick Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 bg-white dark:bg-card-dark p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-4">
          <h3 className="title-sm text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Aperçu géographique en direct
          </h3>
          <MiniMapPreview
            animals={mapPreviewAnimals}
            geofence={primaryGeofence}
            onExpand={() => navigate('/map')}
          />
        </section>

        <aside className="lg:col-span-2">
          <WeatherWidget />
        </aside>
      </div>

      {/* Main Grid */}
      <section>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={layout}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {layout.map((id) => (
                <SortableKpiItem key={id} id={id}>
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
                      value={onlineCount}
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
                </SortableKpiItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <MiniKpi
          icon={<Battery className="text-amber-500" />}
          label="Niveau batterie"
          value={avgBatteryValue}
          sub={`${lowBatteryDevices.length} critiques (<${BATTERY_LOW_THRESHOLD}%)`}
          isAlert={lowBatteryDevices.length > 0}
        />
        <MiniKpi
          icon={<Thermometer className="text-orange-500" />}
          label="Santé troupeau"
          value={avgTemperature}
          sub="Température moyenne"
        />
        <MiniKpi
          icon={<Gauge className="text-blue-500" />}
          label="Charge ingestion"
          value={historicData?.animals?.length > 0
            ? `${((historicData.animals[historicData.animals.length - 1] || 0) / 2).toFixed(0)}%`
            : (kpis && typeof kpis.ingestionRate === 'number' ? `${Math.round(kpis.ingestionRate)}%` : 'N/A — capteur non connecté')}
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
              <div className="h-full flex items-center justify-center text-gray-400">
                Initialisation du flux...
              </div>
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

// --- Sortable KPI Wrapper ---

function SortableKpiItem({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 p-1 text-gray-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-20"
        title="Faire glisser pour réorganiser"
      >
        <GripVertical size={16} />
      </div>
      {children}
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
        <p className="label-xs ml-6">{title}</p> {/* Space for drag handle */}
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
      <div className={`p-2.5 rounded-xl ${isAlert ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-gray-50 dark:bg-gray-800/50'
        }`}>
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

function AlertItem({ alert, onRead }: { alert: IoTAlert; onRead: (id: string | number) => void }) {
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
