import React, { useMemo, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  ArrowLeft, Battery, Thermometer, Wind, Radio,
  MapPin, Clock, Heart, Activity, Compass, AlertTriangle,
  ShieldAlert, Zap, CheckCircle, FileText, Download
} from 'lucide-react';
import { useIoTStore, Alert } from '../../hooks/useIoTStore';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { downloadPDFReport } from '../../services/excelExport';
import { getHealthLabelText, HEALTH_LABEL_BORDERS, HEALTH_LABEL_COLORS, scoreAnimalHealth } from '../../ai/healthScoring';
import { predictBatteryDepletion } from '../../ai/batteryPredictor';
import { downsampleTimeSeries, Point } from '../../utils/downsample';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

// Fix Leaflet icons for Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function TileLayerWithFallback() {
  const [useFallback, setUseFallback] = useState(false);

  if (useFallback) {
    return (
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
    );
  }

  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      eventHandlers={{
        tileerror: () => setUseFallback(true),
      }}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
const healthColor = (h: string) => ({
  Good: { text: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/20' },
  Warning: { text: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20' },
  Critical: { text: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20' },
})[h] || { text: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200' };

// ─── Animated Gauge ────────────────────────────────────────────────────────
function Gauge({ value, max = 100, label, unit, color, icon }: any) {
  const pct = Math.min(Math.max(value / max, 0), 1);
  const angle = -135 + pct * 270; // –135° to +135°
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const arcLength = (270 / 360) * circumference;
  const dashOffset = arcLength * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-[135deg]" viewBox="0 0 100 100">
          {/* Track */}
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-gray-100 dark:stroke-gray-700"
            strokeDasharray={`${arcLength} ${circumference}`} strokeLinecap="round" />
          {/* Fill */}
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" stroke={color}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-gray-900 dark:text-white tabular-nums">{value}</span>
          <span className="text-[9px] font-bold text-gray-400 uppercase">{unit}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
}

// ─── Compass Widget ────────────────────────────────────────────────────────
function CompassWidget({ heading }: { heading: number }) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const dirIdx = Math.round(((heading % 360) + 360) / 45) % 8;
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-2 border-gray-100 dark:border-gray-700 flex items-center justify-center">
          {['N', 'E', 'S', 'O'].map((d, i) => (
            <span key={d} className="absolute text-[9px] font-black text-gray-400"
              style={{
                top: i === 0 ? '4px' : i === 2 ? 'auto' : '50%', bottom: i === 2 ? '4px' : 'auto',
                left: i === 3 ? '4px' : i === 1 ? 'auto' : '50%', right: i === 1 ? '4px' : 'auto',
                transform: (i === 0 || i === 2) ? 'translateX(-50%)' : 'translateY(-50%)'
              }}>
              {d}
            </span>
          ))}
          {/* Needle */}
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ transform: `rotate(${heading}deg)`, transition: 'transform 0.6s ease-out' }}>
            <div className="w-1 h-10 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-5 bg-red-500 rounded-full origin-bottom" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-5 bg-gray-400 rounded-full origin-top" />
            </div>
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 z-10" />
        </div>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-lg font-black text-gray-900 dark:text-white tabular-nums">{heading}°</span>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{dirs[dirIdx]}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Compass className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Cap</span>
      </div>
    </div>
  );
}

// ─── Battery Forecast Sparkline ────────────────────────────────────────────
function BatterySparkline({ battery, history }: { battery: number; history: any[] }) {
  const prediction = useMemo(() => predictBatteryDepletion(history), [history]);
  const recentValues = prediction?.recentValues ?? [];
  const projectedValues = prediction?.projectedValues ?? [];
  const hasProjection = Boolean(prediction && recentValues.length > 1 && projectedValues.length > 0);

  const chartData = useMemo(() => {
    const rawPoints: Point[] = hasProjection
      ? recentValues.map(p => ({ x: new Date(p.timestamp).getTime(), y: p.battery }))
      : [{ x: Date.now(), y: battery }];

    const { sampledData, isCompressed } = downsampleTimeSeries(rawPoints);

    const labels = isCompressed
      ? sampledData.map(p => new Date(p.x).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
      : hasProjection
        ? [
          ...recentValues.map((point) => new Date(point.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })),
          ...projectedValues.map((_, index) => `+${index + 1}`),
        ]
        : [new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })];

    const observedData = isCompressed
      ? sampledData.map(p => p.y)
      : hasProjection
        ? [
          ...recentValues.map((point) => point.battery),
          ...projectedValues.map(() => null),
        ]
        : [battery];

    return {
      labels,
      isCompressed,
      datasets: [
        {
          label: 'Batterie observée',
          data: observedData,
          borderColor: battery < 20 ? '#ef4444' : '#10b981',
          backgroundColor: battery < 20 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'Projection batterie',
          data: hasProjection && !isCompressed
            ? [
              ...recentValues.slice(0, Math.max(0, recentValues.length - 1)).map(() => null),
              recentValues[recentValues.length - 1].battery,
              ...projectedValues.map((point) => point.battery),
            ]
            : [battery],
          borderColor: hasProjection && prediction && prediction.hoursTo10 !== null && prediction.hoursTo10 < 48 ? '#f59e0b' : '#94a3b8',
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.35,
        },
      ],
    };
  }, [battery, recentValues, projectedValues, hasProjection, prediction]);

  const opts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context: any) => {
            let label = `${context.dataset.label}: ${context.parsed.y}%`;
            if (chartData.isCompressed) label += ' (données compressées)';
            return label;
          }
        }
      }
    },
    scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
    animation: { duration: 800 },
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Battery className={`w-4 h-4 ${battery < 20 ? 'text-red-500' : 'text-green-500'}`} />
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Batterie (60 dernières minutes)</span>
        </div>
        <span className={`text-lg font-black tabular-nums ${battery < 20 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {battery}%
        </span>
      </div>
      {hasProjection && prediction && prediction.hoursTo10 !== null && prediction.hoursTo10 < 48 && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          Batterie estimée à 10% dans {prediction.hoursTo10.toFixed(1)} heures
          <span className="ml-2 text-[11px] font-bold uppercase tracking-wider opacity-80">
            {prediction.isReliable ? 'Prédiction fiable' : 'Prédiction à surveiller'}
          </span>
        </div>
      )}
      <div className="h-20">
        <Line data={chartData} options={opts} />
      </div>
      {prediction && (
        <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
          <span>Pente: {prediction.slopePerHour.toFixed(2)} %/h</span>
          <span>R²: {prediction.rSquared.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

function HealthScoreGauge({ score, label, concernLabel, concernScore, recentAlertCount }: {
  score: number;
  label: string;
  concernLabel: string;
  concernScore: number;
  recentAlertCount: number;
}) {
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.82;
  const dashOffset = arcLength * (1 - pct);
  const toneClass = score >= 85 ? 'text-emerald-600 dark:text-emerald-400' : score >= 70 ? 'text-green-600 dark:text-green-400' : score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const borderClass = score >= 85 ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-500/10' : score >= 70 ? 'border-green-200 dark:border-green-500/20 bg-green-50/70 dark:bg-green-500/10' : score >= 50 ? 'border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/10' : 'border-red-200 dark:border-red-500/20 bg-red-50/70 dark:bg-red-500/10';

  return (
    <div className={`p-5 rounded-2xl border ${borderClass}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Score de santé global</p>
          <h3 className={`mt-1 text-2xl font-black tracking-tight ${toneClass}`}>{score}/100</h3>
          <p className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${HEALTH_LABEL_BORDERS[label as keyof typeof HEALTH_LABEL_BORDERS] || ''} ${HEALTH_LABEL_COLORS[label as keyof typeof HEALTH_LABEL_COLORS] || ''}`}>{getHealthLabelText(label as any)}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative h-32 w-32 shrink-0">
            <svg className="h-full w-full -rotate-[135deg]" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-gray-100 dark:stroke-gray-800" strokeDasharray={`${arcLength} ${circumference}`} />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                strokeWidth="10"
                className={score >= 85 ? 'stroke-emerald-500' : score >= 70 ? 'stroke-green-500' : score >= 50 ? 'stroke-amber-500' : 'stroke-red-500'}
                strokeDasharray={`${arcLength} ${circumference}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-black tabular-nums ${toneClass}`}>{score}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">sur 100</span>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-bold text-gray-900 dark:text-white">Métrique la plus préoccupante</p>
            <p className="text-gray-600 dark:text-gray-300">
              {concernLabel} - {concernScore}/100
            </p>
            <p className="text-xs text-gray-400">{recentAlertCount} alerte(s) récente(s) sur la fenêtre analysée</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Alert item ────────────────────────────────────────────────────────────
function AlertRow({ alert }: { alert: Alert }) {
  const icons: Record<string, React.ReactNode> = {
    OUT_OF_ZONE: <ShieldAlert className="w-4 h-4" />,
    LOW_BATTERY: <Battery className="w-4 h-4" />,
    HEALTH_WARNING: <Activity className="w-4 h-4" />,
    COLLAR_OFFLINE: <Zap className="w-4 h-4" />,
  };
  return (
    <div className={`flex gap-3 p-3 rounded-xl border ${alert.severity === 'CRITICAL'
      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
      : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400'
      }`}>
      <div className="p-1.5 rounded-lg bg-white/60 dark:bg-black/20 self-start">{icons[alert.type] ?? <AlertTriangle className="w-4 h-4" />}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase tracking-wide">{alert.type.replace('_', ' ')}</p>
        <p className="text-[10px] opacity-75 mt-0.5">{new Date(alert.timestamp).toLocaleString()}</p>
      </div>
      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full self-center border ${alert.severity === 'CRITICAL' ? 'bg-red-100 dark:bg-red-500/20 border-red-200 dark:border-red-500/30' : 'bg-amber-100 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30'
        }`}>{alert.severity}</span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function AnimalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exportingReport, setExportingReport] = useState(false);

  // Subscribed selectors to receive live updates from the Zustand store
  const animal = useIoTStore(state => (id ? state.devices[id] : undefined));
  const history = useIoTStore(state => (id ? state.history[id] || [] : []));
  const allAlerts = useIoTStore(state => state.alerts);

  const recentHistory = useMemo(() => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    return history.filter(h => {
      const ts = new Date(h.lastUpdate || 0).getTime();
      return ts > twoHoursAgo;
    });
  }, [history]);

  const healthScore = useMemo(() => (animal ? scoreAnimalHealth(animal, allAlerts) : null), [animal, allAlerts]);

  const handleDownloadVeterinaryReport = async () => {
    try {
      setExportingReport(true);
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      await downloadPDFReport('veterinary', {
        sheepId: id,
        startDate,
        endDate
      });
    } catch (error) {
      console.error('Erreur téléchargement rapport vétérinaire:', error);
      alert('Erreur lors du téléchargement du rapport vétérinaire');
    } finally {
      setExportingReport(false);
    }
  };

  // Filter alerts for this animal
  const animalAlerts = useMemo(
    () => allAlerts.filter(a => a.collar_id === id).slice(0, 10),
    [allAlerts, id]
  );

  if (!animal) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="text-4xl animate-bounce">🐑</div>
        <p className="font-black text-gray-400 uppercase text-sm tracking-widest">Animal introuvable</p>
        <button onClick={() => navigate('/animals')}
          className="text-primary text-sm font-bold flex items-center gap-2 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Retour au troupeau
        </button>
      </div>
    );
  }

  const hc = healthColor(animal.health);
  const bat = animal.battery ?? 0;
  const temp = animal.temperature ?? 0;
  const speed = animal.speed ?? 0;
  const rssiPct = Math.round((Math.max(-100, Math.min(-40, animal.rssi ?? -90)) + 100) / 60 * 100);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/animals')}
          className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <span className="text-2xl">🐑</span>
            {animal.name}
            <span className={`text-xs px-2.5 py-1 rounded-full border font-black uppercase tracking-wide ${hc.bg} ${hc.text} ${hc.border}`}>
              {animal.health}
            </span>
            {animal.health === 'Critical' && (
              <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            )}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mt-1">
            Collier <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs text-primary font-bold">{animal.collar_id}</span>
            {animal.breed && <> · {animal.breed}</>}
            {animal.lastUpdate && <> · Mis à jour <span className="font-bold">{animal.lastUpdate}</span></>}
          </p>
        </div>
        <button
          onClick={handleDownloadVeterinaryReport}
          disabled={exportingReport}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm font-medium transition disabled:opacity-50"
        >
          <FileText className="w-4 h-4" />
          {exportingReport ? 'Génération...' : 'Rapport Vétérinaire'}
        </button>
      </div>

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Gauges + Meta */}
        <div className="lg:col-span-2 space-y-6">
          {/* 4 Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Gauge value={bat} max={100} label="Batterie" unit="%" color={bat < 20 ? '#ef4444' : '#10b981'}
              icon={<Battery className={`w-3.5 h-3.5 ${bat < 20 ? 'text-red-500' : 'text-green-500'}`} />} />
            <Gauge value={temp.toFixed(1)} max={45} label="Température" unit="°C"
              color={temp > 40 ? '#ef4444' : '#f59e0b'}
              icon={<Thermometer className="w-3.5 h-3.5 text-orange-500" />} />
            <Gauge value={(speed || 0).toFixed(1)} max={10} label="Vitesse" unit="km/h" color="#3b82f6"
              icon={<Wind className="w-3.5 h-3.5 text-blue-500" />} />
            <Gauge value={rssiPct} max={100} label="Signal" unit="%" color="#8b5cf6"
              icon={<Radio className="w-3.5 h-3.5 text-purple-500" />} />
          </div>

          {healthScore && (
            <HealthScoreGauge
              score={healthScore.score}
              label={healthScore.label}
              concernLabel={healthScore.mostConcerningMetric.label}
              concernScore={healthScore.mostConcerningMetric.score}
              recentAlertCount={healthScore.recentAlertCount}
            />
          )}

          {/* Battery Sparkline */}
          <BatterySparkline battery={bat} history={history} />

          {/* GPS Info */}
          <div className="p-5 bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Position GPS Actuelle</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Latitude</p>
                <p className="text-base font-black font-mono text-gray-900 dark:text-white tabular-nums">{animal.lat?.toFixed(5)}</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Longitude</p>
                <p className="text-base font-black font-mono text-gray-900 dark:text-white tabular-nums">{animal.lng?.toFixed(5)}</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Points historique</p>
                <p className="text-base font-black text-gray-900 dark:text-white tabular-nums">
                  {history.length} pts
                  {history.length > 200 && <span className="text-[10px] text-orange-500 ml-1">(optimisé)</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Alert History */}
          <div className="p-5 bg-white dark:bg-card-dark rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Historique des Alertes</span>
              <span className="ml-auto text-[10px] font-bold text-gray-400">{animalAlerts.length} alertes</span>
            </div>
            {animalAlerts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-8 h-8 text-green-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400 font-bold">Aucune alerte pour cet animal</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {animalAlerts.map(a => <AlertRow key={`${a.id}`} alert={a} />)}
              </div>
            )}
          </div>
        </div>

        {/* Right: Compass + Mini-map */}
        <div className="space-y-6">
          <CompassWidget heading={animal.heading ?? 0} />

          {/* Mini Map */}
          <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm" style={{ height: 320 }}>
            {animal.lat && animal.lng ? (
              <MapContainer
                center={[animal.lat, animal.lng]}
                zoom={16}
                className="h-full w-full"
                zoomControl={false}
                scrollWheelZoom={false}
              >
                <TileLayerWithFallback />
                {recentHistory.length > 1 && (
                  <Polyline
                    positions={recentHistory.map(h => [h.lat, h.lng] as [number, number])}
                    pathOptions={{ color: '#10b981', weight: 3, opacity: 0.7, dashArray: '8,6' }}
                  />
                )}
                <Marker position={[animal.lat, animal.lng]}>
                  <Popup><b>{animal.name}</b><br />{animal.collar_id}</Popup>
                </Marker>
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                <p className="text-gray-400 text-sm">GPS non disponible</p>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="p-4 bg-white dark:bg-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Métriques Rapides</p>
            {[
              { label: 'RSSI', value: `${animal.rssi ?? '—'} dBm`, icon: <Radio className="w-3.5 h-3.5 text-purple-500" /> },
              { label: 'Vitesse', value: `${(animal.speed ?? 0).toFixed(1)} km/h`, icon: <Wind className="w-3.5 h-3.5 text-blue-500" /> },
              { label: 'Température', value: `${(animal.temperature ?? 0).toFixed(1)} °C`, icon: <Thermometer className="w-3.5 h-3.5 text-orange-500" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {icon}
                  <span className="text-xs font-bold text-gray-500">{label}</span>
                </div>
                <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
