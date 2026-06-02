import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Download, RefreshCw, BarChart3, Map as MapIcon, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import GPSHeatmap from './components/GPSHeatmap';
import BatteryChart from './components/BatteryChart';
import KPIStats from './components/KPIStats';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  predictBatteryDepletion,
  downloadCSVReport
} from './utils/analyticsHelpers';
import { useIoTStore } from '../../hooks/useIoTStore';
import { useIoTStore as _useIoTStore } from '../../hooks/useIoTStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryPoint {
  animalId: string | number;
  lat: number;
  lng: number;
  timestamp: string;
  battery: number;
  temp: number;
}

interface SheepRecord {
  collar_id?: string;
  _id?: string;
  name?: string;
  battery?: number;
  temperature?: number;
  activity_level?: number;
  [key: string]: any;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const AnalyticsSkeleton = () => (
  <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4">
    {/* Header skeleton */}
    <div className="glass p-6 rounded-3xl border border-white/20 dark:border-slate-800/50 shadow-xl flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-7 w-36 skeleton rounded-xl" />
        <div className="h-4 w-56 skeleton rounded-lg" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-52 skeleton rounded-2xl" />
        <div className="h-10 w-32 skeleton rounded-2xl" />
      </div>
    </div>
    {/* KPI cards skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="glass p-5 rounded-2xl border border-white/20 dark:border-slate-800/50 flex items-center justify-between h-24">
          <div className="space-y-2">
            <div className="h-3 w-24 skeleton rounded" />
            <div className="h-8 w-16 skeleton rounded-lg" />
          </div>
          <div className="w-12 h-12 skeleton rounded-xl" />
        </div>
      ))}
    </div>
    {/* Charts skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="glass rounded-3xl border border-white/20 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="h-5 w-40 skeleton rounded-lg" />
        </div>
        <div className="p-4 h-72 skeleton rounded-b-3xl" />
      </div>
      <div className="glass rounded-3xl border border-white/20 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="h-5 w-44 skeleton rounded-lg" />
        </div>
        <div className="p-6 h-72 skeleton rounded-b-3xl" />
      </div>
    </div>
  </div>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSheepArray(data: any): SheepRecord[] {
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.sheep && Array.isArray(data.sheep)) return data.sheep;
  return [];
}

function parseHistoryArray(data: any): HistoryPoint[] {
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.history && Array.isArray(data.history)) return data.history;
  return [];
}

// ─── Component ────────────────────────────────────────────────────────────────

const Analytics = () => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || 'light';

  const [period, setPeriod] = useState<string>('7d');
  const [customDates, setCustomDates] = useState({
    from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  const { token } = useAuth();

  // ── Query 1: GET /api/sheep → live KPIs (battery, temp, most active) ────────
  const fetchSheepData = async (): Promise<any[]> => {
    try {
      const storeState = _useIoTStore.getState();
      if (!storeState.isConnected && !storeState.isOfflineData) return [];
      const res = await api.get('/sheep', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      let data = [];
      if (Array.isArray(res.data)) data = res.data;
      else if (res.data?.data && Array.isArray(res.data.data)) data = res.data.data;
      else if (res.data?.sheep && Array.isArray(res.data.sheep)) data = res.data.sheep;

      if (data.length > 0) return data;
      // If empty, fallback to store (e.g. simulation mode)
      return Object.values(useIoTStore.getState().devices);
    } catch (e) {
      console.warn('Sheep API error, fallback to store', e);
      return Object.values(useIoTStore.getState().devices);
    }
  };

  const { data: sheepData, isLoading: sheepLoading, isError: sheepError } = useQuery<any[]>({
    queryKey: ['sheepData', token],
    queryFn: fetchSheepData,
    placeholderData: [] as any[],
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 2000
  });

  // ── Query 2: GET /api/telemetry/history → chart data + GPS heatmap ──────────
  const dateParams = useMemo(() => {
    let fromDate: Date, toDate: Date;
    if (period === '7d') {
      fromDate = subDays(new Date(), 7);
      toDate = new Date();
    } else if (period === '30d') {
      fromDate = subDays(new Date(), 30);
      toDate = new Date();
    } else {
      fromDate = new Date(customDates.from);
      toDate = new Date(customDates.to);
    }
    return {
      from: startOfDay(fromDate).toISOString(),
      to: endOfDay(toDate).toISOString()
    };
  }, [period, customDates]);

  const {
    data: history,
    isLoading: historyLoading,
    isRefetching,
    isError: historyError
  } = useQuery<HistoryPoint[]>({
    queryKey: ['telemetryHistory', dateParams],
    queryFn: async () => {
      try {
        const res = await api.get('/telemetry/history', {
          params: dateParams,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        const parsed = parseHistoryArray(res.data);
        if (parsed.length > 0) return parsed;
        throw new Error('empty');
      } catch (err) {
        console.warn('[Analytics] /api/telemetry/history failed, using Zustand fallback:', err);
        // Convert Zustand IoT history → HistoryPoint[]
        const iotHistory = useIoTStore.getState().history;
        const flat: HistoryPoint[] = [];
        Object.entries(iotHistory).forEach(([id, points]) => {
          points.forEach(p => {
            flat.push({
              animalId: id,
              lat: p.lat ?? 0,
              lng: p.lng ?? 0,
              timestamp: (p as any).last_update || new Date().toISOString(),
              battery: p.battery ?? 0,
              temp: p.temperature ?? 0
            });
          });
        });
        return flat;
      }
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    placeholderData: [] as HistoryPoint[]
  });

  // ── Derived KPIs from sheep endpoint (or Zustand fallback) ──────────────────
  const stats = useMemo(() => {
    if (!sheepData || sheepData.length === 0) {
      return { avgBattery: 0, avgTemp: 0, mostActiveId: 'N/A', totalPoints: history?.length || 0 };
    }

    const total = sheepData.length;
    const avgBattery = sheepData.reduce((a, s) => a + (s.battery ?? 0), 0) / total;
    const avgTemp = sheepData.reduce((a, s) => a + (s.temperature ?? 0), 0) / total;

    let mostActiveId = sheepData[0].collar_id || sheepData[0]._id || sheepData[0].id || 'N/A';

    if (history && history.length > 0) {
      const counts: Record<string, number> = {};
      let max = 0;
      for (let i = 0; i < history.length; i++) {
        const id = String(history[i].animalId);
        counts[id] = (counts[id] || 0) + 1;
        if (counts[id] > max) {
          max = counts[id];
          mostActiveId = id;
        }
      }
    }

    return {
      avgBattery: Math.round(avgBattery),
      avgTemp: Math.round(avgTemp * 10) / 10,
      mostActiveId,
      totalPoints: history?.length || 0
    };
  }, [sheepData, history]);

  // ── Battery depletion prediction ────────────────────────────────────────────
  const batteryPrediction = useMemo(() => {
    return predictBatteryDepletion(history || []);
  }, [history]);

  const handleExport = () => downloadCSVReport(history || []);

  const isInitialLoading = (sheepLoading || historyLoading) &&
    (!sheepData || sheepData.length === 0) &&
    (!history || history.length === 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isInitialLoading) return <AnalyticsSkeleton />;

  const apiErrorBanner = (sheepError || historyError) && (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl text-amber-700 dark:text-amber-400 text-xs font-medium">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>API indisponible — données du store temps réel utilisées.</span>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass p-6 rounded-3xl border border-white/20 dark:border-slate-800/50 shadow-xl shadow-primary/5">
        <div>
          <h2 className="title-lg text-slate-900 dark:text-white tracking-tight leading-none">Analytique</h2>
          <p className="label-xs mt-2">Surveillance et statistiques du troupeau</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-black/5">
            {['7d', '30d', 'custom'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl label-xs font-black transition-all ${period === p
                  ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : 'Personnalisé'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-2xl label-xs font-black hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            <Download className="w-4 h-4" />
            <span>Exportation</span>
          </button>
        </div>
      </div>

      {/* API error banner */}
      {apiErrorBanner}

      {/* Custom date pickers */}
      {period === 'custom' && (
        <div className="glass p-5 rounded-2xl border border-white/20 animate-slide-up bg-white/20 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="label-xs text-slate-500">Début</span>
            <input
              type="date"
              value={customDates.from}
              onChange={e => setCustomDates(prev => ({ ...prev, from: e.target.value }))}
              className="bg-transparent border-b border-primary/30 outline-none font-bold text-sm dark:text-white"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="label-xs text-slate-500">Fin</span>
            <input
              type="date"
              value={customDates.to}
              onChange={e => setCustomDates(prev => ({ ...prev, to: e.target.value }))}
              className="bg-transparent border-b border-primary/30 outline-none font-bold text-sm dark:text-white"
            />
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <KPIStats kpis={stats} prediction={batteryPrediction} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-3xl overflow-hidden border border-white/20 shadow-xl">
          <div className="p-6 border-b border-white/10">
            <h3 className="title-md text-slate-800 dark:text-white flex items-center gap-2">
              <MapIcon className="w-5 h-5 text-primary" />
              Zone de pâturage
            </h3>
          </div>
          <div className="p-4">
            <GPSHeatmap data={history || []} theme={theme} />
          </div>
        </div>

        <div className="glass rounded-3xl overflow-hidden border border-white/20 shadow-xl">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h3 className="title-md text-slate-800 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Niveaux de batterie
            </h3>
            {isRefetching && <RefreshCw className="w-4 h-4 animate-spin text-primary" />}
          </div>
          <div className="p-6">
            <BatteryChart data={history || []} theme={theme} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
