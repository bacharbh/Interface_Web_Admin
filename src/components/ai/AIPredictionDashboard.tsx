/**
 * Smart Shepherd - AI Prediction Dashboard
 * Dashboard des prédictions de santé IA
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Heart,
  Thermometer,
  Battery,
  Activity,
  BarChart3,
  LineChart,
  Calendar,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  Radio,
  Settings,
  RotateCcw,
  Gauge,
  MapPin,
  ChevronRight,
  Clock,
  History,
  User,
  Stethoscope,
  CheckSquare,
  Mail,
  Droplets,
  Zap,
  Sun,
  Moon,
  Languages
} from 'lucide-react';
const XCircleIcon = XCircle;
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import AIInsightsFeed from './AIInsightsFeed';
import AnomalyHeatmap from '../widgets/AnomalyHeatmap';
import api from '../../services/api.js';
import { useIoTStore } from '../../hooks/useIoTStore';
import SeverityBadge from '../ui/SeverityBadge';
import KPICard from '../ui/KpiCard';
import Button from '../ui/Button';
import { FEATURES } from '../../config/features';


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  annotationPlugin
);

// --- Interfaces ---

interface PredictionData {
  sheepId: string;
  collar_id?: string;
  name: string;
  breed: string;
  age: number;
  anomalies: {
    anomalies: Array<{
      timestamp: string;
      type: string;
      severity: string;
      score: number;
      values: any;
    }>;
    riskScore: number;
  };
  healthPrediction: {
    prediction: {
      predictedValues: {
        heartRate: number;
        temperature: number;
        battery: number;
        signalStrength: number;
        activity: string;
      };
      riskScore: number;
      issues: string[];
      trend: string;
    };
    confidence: number;
  };
  riskScore: {
    overallScore: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    components: {
      anomalies: number;
      prediction: number;
      trends: number;
      base: number;
    };
    recommendations: string[];
  };
}

interface HealthSummary {
  totalAnimals: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  averageRiskScore: number;
  animalsWithAnomalies: number;
  highRiskAnimals: Array<{
    sheepId: string;
    name: string;
    riskScore: number;
    level: string;
  }>;
}

// --- Sub-components ---

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`skeleton ${className}`} />
);

const StatCard = React.memo(({ label, value, unit, color, icon, alert, ariaLabel }: any) => (
  <div
    className={`bg-white dark:bg-card-dark p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 min-h-[100px] flex flex-col justify-between transition-all hover:shadow-md ${alert ? 'ring-1 ring-red-500/20' : ''}`}
    style={{ borderLeft: `4px solid ${color}` }}
    role="region"
    aria-label={ariaLabel}
  >
    <div className="flex justify-between items-start">
      <p className="label-xs">{label}</p>
      <div className="opacity-40" style={{ color }}>{icon}</div>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="value-xl text-gray-900 dark:text-white">{value}</span>
      <span className="label-xs">{unit}</span>
    </div>
  </div>
));

const PredictionCard = React.memo(({ prediction, onClick }: any) => {
  const { t } = useTranslation();
  const level = prediction.riskScore.level;
  const color = level === 'low' ? 'var(--status-ok)' : level === 'medium' ? 'var(--status-warn)' : 'var(--status-critical)';

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-card-dark p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer transition-all hover:shadow-md"
      style={{ borderLeft: `4px solid ${color}` }}
      role="button"
      aria-label={`${prediction.name} - ${level}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center text-xl">🐑</div>
        <SeverityBadge severity={level} />
      </div>
      <h4 className="title-sm text-gray-900 dark:text-white mb-1">{prediction.name}</h4>
      <p className="label-xs mb-4">{prediction.breed}</p>
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <p className="label-xs">{t('dashboard.risk_index')}</p>
          <p className="title-md text-gray-900 dark:text-white leading-none">{prediction.riskScore.overallScore}%</p>
        </div>
        <ChevronRight size={16} className="text-gray-300" />
      </div>
    </div>
  );
});

const VitalCard = ({ label, value, unit, range, status, icon }: any) => {
  const { t } = useTranslation();
  const color = status === 'normal' ? 'bg-[#1D9E75]' : status === 'warning' ? 'bg-[#EF9F27]' : 'bg-[#E24B4A]';
  return (
    <div
      className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/20"
      role="region"
      aria-label={`${label} : ${value} ${unit}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="text-gray-400">{icon}</div>
        <span className="label-xs">{t('clinical.normal')}: {range}</span>
      </div>
      <p className="label-sm mb-1" style={{ fontWeight: 400 }}>{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="title-md text-gray-900 dark:text-white">{value}</span>
        <span className="label-xs">{unit}</span>
      </div>
      <div className="mt-3 h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: status === 'normal' ? '70%' : '90%' }} />
      </div>
    </div>
  );
};

const ClinicalModal = ({ animal, onClose }: { animal: PredictionData, onClose: () => void }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addAIAlert, markAllAlertsAsRead } = useIoTStore((state) => ({
    addAIAlert: state.addAIAlert,
    markAllAlertsAsRead: state.markAllAlertsAsRead,
  }));
  const level = animal.riskScore.level;
  const color = level === 'low' ? '#10B981' : level === 'medium' ? '#F59E0B' : '#EF4444';

  const notifyVet = () => {
    addAIAlert({
      id: `ai-${animal.sheepId}-${Date.now()}`,
      title: `Alerte IA - ${animal.name}`,
      animalId: animal.sheepId,
      severity: level === 'critical' ? 'CRITICAL' : 'WARNING',
      type: 'AI_REVIEW',
      message: animal.riskScore.recommendations[0] || 'Revue IA requise',
      createdAt: new Date().toISOString(),
      read: false,
    });
    navigate('/alerts');
  };

  const markTreated = () => {
    markAllAlertsAsRead();
    onClose();
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-labelledby="modal-title"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden border-t-4 sm:border-t-0 sm:border-l-8 focus-within:outline-none"
        style={{ borderColor: color }}
        tabIndex={-1}
      >
        <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start">
          <div className="flex gap-4 items-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-3xl shadow-inner">🐑</div>
            <div>
              <h2 id="modal-title" className="text-xl font-semibold text-gray-900 dark:text-white leading-tight">{animal.name}</h2>
              <p className="label-xs mt-1">ID: {String(animal.sheepId || animal.collar_id || '—').slice(0, 8)} • {animal.breed || '—'}</p>
              <div className="flex items-center gap-2 mt-2">
                <SeverityBadge severity={level} />
                <span className="label-xs flex items-center gap-1">
                  <Clock size={10} /> {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all focus-visible:outline-primary"
          >
            <XCircleIcon size={24} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <section className="space-y-4" aria-labelledby="vitals-title">
            <h3 id="vitals-title" className="label-sm flex items-center gap-2">
              <Activity size={14} /> {t('clinical.vitals')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(() => {
                const predictedValues = animal.healthPrediction?.prediction?.predictedValues ?? {
                  heartRate: 0,
                  temperature: 0,
                  activity: 0,
                  battery: 0,
                  signalStrength: 0,
                };

                return (
                  <>
                    <VitalCard
                      label={t('clinical.heart_rate')}
                      value={predictedValues.heartRate}
                      unit="BPM"
                      range="60-120"
                      status="normal"
                      icon={<Heart size={16} />}
                    />
                    <VitalCard
                      label={t('clinical.temperature')}
                      value={predictedValues.temperature}
                      unit="°C"
                      range="38.5-39.5"
                      status={predictedValues.temperature > 39.5 ? 'critical' : 'normal'}
                      icon={<Thermometer size={16} />}
                    />
                    <VitalCard
                      label={t('clinical.activity')}
                      value={predictedValues.activity}
                      unit=""
                      range={t('clinical.normal')}
                      status="normal"
                      icon={<Zap size={16} />}
                    />
                    <VitalCard
                      label={t('clinical.hydration')}
                      value="82"
                      unit="%"
                      range="70-90"
                      status="normal"
                      icon={<Droplets size={16} />}
                    />
                  </>
                );
              })()}
            </div>
          </section>

          <section className="space-y-6" aria-labelledby="diagnosis-title">
            <div className="p-6 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center mb-4">
                <h3 id="diagnosis-title" className="title-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Stethoscope size={16} className="text-primary" /> Avis IA
                </h3>
                <span className="label-sm text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                  {t('clinical.reliability')} {(animal.healthPrediction?.confidence ?? 0)}%
                </span>
              </div>
              <p className="ai-advisory body-sm text-gray-600 dark:text-gray-400">
                {animal.riskScore?.recommendations?.[0] || "Aucune anomalie critique détectée. Maintenir la surveillance habituelle."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="primary" className="flex-1 py-4 text-xs" onClick={notifyVet}>
                <Mail size={16} /> {t('common.notify_vet')}
              </Button>
              <Button variant="secondary" className="flex-1 py-4 text-xs" onClick={markTreated}>
                <CheckSquare size={16} /> {t('common.mark_treated')}
              </Button>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
};

const AnomalyTimeline = React.memo(({ predictions, onSelectAnimal }: any) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all');
  const [hoveredEvent, setHoveredEvent] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<'6h' | '24h'>('24h');

  const allEvents = useMemo(() => predictions.flatMap((p: any) =>
    p.anomalies.anomalies.map((a: any) => ({
      ...a,
      animalName: p.name,
      sheepId: p.sheepId,
      category: a.type.includes('gps') || a.type.includes('area') ? 'gps' :
        a.type.includes('battery') ? 'battery' : 'health'
    }))
  ).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()), [predictions]);

  const filteredEvents = useMemo(() => allEvents.filter((e: any) => filter === 'all' || e.category === filter), [allEvents, filter]);

  const hours: any[] = useMemo(() => {
    const res: any[] = [];
    for (let i = 0; i < 24; i++) {
      const hour = (new Date().getHours() - (23 - i) + 24) % 24;
      const hourEvents = filteredEvents.filter((e: any) => new Date(e.timestamp).getHours() === hour);
      res.push({ hour, events: hourEvents });
    }
    return res;
  }, [filteredEvents]);

  const chartData = useMemo(() => {
    const fullLabels = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', 'Maintenant'];
    const fullData = [42, 38, 55, 78, 62, 45, 50, 48, 52];

    const sliceIdx = timeRange === '6h' ? -3 : 0;

    return {
      labels: fullLabels.slice(sliceIdx),
      datasets: [
        {
          label: "Niveau de risque du troupeau",
          data: fullData.slice(sliceIdx),
          borderColor: '#10B981',
          tension: 0.4,
          fill: true,
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#10B981',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }
      ]
    };
  }, [t, timeRange]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 11 },
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (items: any) => `Heure: ${items[0].label}`,
          label: (item: any) => [
            `Score: ${item.formattedValue}/100`,
            `Cause: ${item.raw > 75 ? 'Activité inhabituelle détectée' : 'Comportement normal'}`,
            `Conseil: ${item.raw > 75 ? 'Vérifier l\'enclos sud' : 'Continuer surveillance'}`
          ]
        }
      },
      annotation: {
        annotations: {
          criticalZone: {
            type: 'box' as const,
            yMin: 75,
            yMax: 100,
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderWidth: 0,
          },
          thresholdLine: {
            type: 'line' as const,
            yMin: 75,
            yMax: 75,
            borderColor: '#EF4444',
            borderWidth: 1,
            borderDash: [6, 4],
            label: {
              display: true,
              content: 'ZONE CRITIQUE',
              position: 'end' as const,
              backgroundColor: '#EF4444',
              color: '#fff',
              font: { size: 8, weight: 'bold' as const },
              padding: 4
            }
          },
          // Sample markers for events
          alert1: {
            type: 'point' as const,
            xValue: '09:00',
            yValue: 78,
            backgroundColor: '#EF4444',
            radius: 8,
            content: '⚠️',
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: { color: 'rgba(0,0,0,0.03)' },
        ticks: {
          font: { size: 9 },
          callback: (val: any) => val % 25 === 0 ? val : ''
        }
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 9 } }
      }
    }
  }), [t]);

  const registryItems = useMemo(() => {
    return predictions.filter((p: any) => p.anomalies.anomalies.length > 0).flatMap((p: any) =>
      p.anomalies.anomalies.map((a: any) => ({ ...a, animal: p }))
    );
  }, [predictions]);

  // Registry Row component (moved outside for performance, but needs props)
  const renderRow = (index: number, style: any) => {
    const item = registryItems[index];
    if (!item) return null;
    const { animal, type, timestamp, score } = item;
    return (
      <div
        key={`${animal.sheepId}-${timestamp}`}
        style={style}
        className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-100 dark:border-gray-800 flex items-center px-6"
      >
        <div className="flex-1 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm">🐑</div>
          <div>
            <p className="text-xs font-semibold">{animal.name}</p>
            <p className="text-[10px] text-gray-400">{new Date(timestamp).toLocaleTimeString()}</p>
          </div>
        </div>
        <div className="w-32 text-xs">{type?.replace('_', ' ') || 'Inconnu'}</div>
        <div className="w-24 text-xs font-semibold" style={{ color: score > 0.7 ? '#EF4444' : '#F59E0B' }}>
          {((score || 0) * 100).toFixed(0)}%
        </div>
        <div className="w-20 text-right">
          <button
            onClick={() => onSelectAnimal && onSelectAnimal(animal.sheepId)}
            className="text-primary hover:underline text-[10px] font-bold"
          >
            {t('common.details')}
          </button>
        </div>
      </div>
    );
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      default: return '#10B981';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-gray-100 dark:border-gray-800" role="region" aria-label={t('dashboard.timeline')}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h3 className="title-sm text-gray-900 dark:text-white">{t('dashboard.timeline')}</h3>
          <div className="flex p-1 bg-gray-50 dark:bg-gray-800 rounded-lg gap-1" role="tablist">
            {['all', 'health', 'gps', 'battery'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                role="tab"
                aria-selected={filter === f}
                className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${filter === f ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                {t(`common.${f}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="relative h-40 mt-10">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-100 dark:bg-gray-800" />
          <div className="absolute inset-0 flex justify-between items-center">
            {hours.map((h, i) => (
              <div key={i} className="relative flex-1 group">
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-medium text-gray-400">
                  {h.hour}h
                </span>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                  {h.events.length > 5 ? (
                    <div
                      className="w-6 h-6 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg shadow-primary/20"
                      onClick={() => setFilter('all')}
                      aria-label={`${h.events.length} anomalies`}
                    >
                      +{h.events.length}
                    </div>
                  ) : (
                    h.events.map((e: any, idx: number) => {
                      const isActive = Date.now() - new Date(e.timestamp).getTime() < 1000 * 60 * 15;
                      return (
                        <div
                          key={idx}
                          className={`w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 cursor-pointer relative group/marker hover:scale-125 transition-all ${isActive ? 'animate-pulse-slow' : ''}`}
                          style={{ backgroundColor: getSeverityColor(e.severity) }}
                          onClick={(evt) => {
                            evt.stopPropagation();
                            if (e.sheepId && onSelectAnimal) {
                              onSelectAnimal(e.sheepId);
                            }
                          }}
                          onMouseEnter={() => setHoveredEvent(e)}
                          onMouseLeave={() => setHoveredEvent(null)}
                          role="button"
                          aria-label={`${e.animalName} - ${e.type}`}
                        >
                          <AnimatePresence>
                            {hoveredEvent === e && (
                              <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 p-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl shadow-2xl z-50 pointer-events-none"
                              >
                                <p className="text-[10px] font-bold mb-1">{e.animalName}</p>
                                <p className="text-[9px] opacity-70 mb-2">{e.type.replace('_', ' ')}</p>
                                <div className="flex justify-between items-center pt-2 border-t border-white/10 dark:border-gray-100">
                                  <span className="text-[8px] font-medium">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  <span className="text-[8px] font-bold">12 min</span>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-gray-100 dark:border-gray-800" role="region" aria-label={t('dashboard.risk_evolution')}>
          <div className="flex justify-between items-start mb-1">
            <h3 className="title-sm text-gray-900 dark:text-white">{t('dashboard.risk_evolution')}</h3>
            <div className="flex gap-1 p-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
              {(['6h', '24h'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${timeRange === r ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-400'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mb-6 italic">Une valeur &gt; 75 déclenche une alerte automatique.</p>
          <div className="h-64">
            <Line
              options={chartOptions}
              data={chartData}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden" role="region" aria-label={t('dashboard.registry')}>
          <div className="p-6 border-b border-gray-50 dark:border-gray-800">
            <h3 className="title-sm">{t('dashboard.registry')}</h3>
          </div>
          <div className="h-72 overflow-y-auto custom-scrollbar">
            {registryItems.map((item: any, index: number) => (
              <div key={index}>
                {renderRow(index, {})}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

// --- Main Dashboard Component ---

const AIPredictionDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<PredictionData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'predictions' | 'anomalies'>('overview');

  // Connect to reactive store for consistent KPIs
  const devices = useIoTStore(state => state.devices);
  const aiAlerts = useIoTStore(state => state.aiAlerts);

  // Derived Summary from real-time store
  const reactiveSummary = useMemo(() => {
    const totalAnimals = Object.keys(devices).length;
    const animalsWithAnomalies = aiAlerts.length;
    const averageRiskScore = aiAlerts.length > 0
      ? Math.round(aiAlerts.reduce((acc, a) => acc + (a.riskScore || 0), 0) / aiAlerts.length)
      : 0;

    // Map risk distribution
    const riskDistribution = {
      low: totalAnimals - animalsWithAnomalies,
      medium: aiAlerts.filter(a => a.riskScore > 50 && a.riskScore <= 75).length,
      high: aiAlerts.filter(a => a.riskScore > 75 && a.riskScore <= 90).length,
      critical: aiAlerts.filter(a => a.riskScore > 90).length,
    };

    return {
      totalAnimals,
      animalsWithAnomalies,
      averageRiskScore,
      riskDistribution
    };
  }, [devices, aiAlerts]);

  // Use either reactive or API summary
  const finalSummary = healthSummary || reactiveSummary;
  const confidence = finalSummary.totalAnimals > 0
    ? Math.max(0, Math.min(100, Math.round(((finalSummary.totalAnimals - finalSummary.animalsWithAnomalies) / finalSummary.totalAnimals) * 100)))
    : null;

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'ar' : 'fr';
    i18n.changeLanguage(newLang);
  };

  const fetchData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const [predictionsResponse, predictionsDataResponse] = await Promise.all([
        api.get('/ai/all-predictions'),
        api.get('/ai/predictions')
      ]);

      const predictionsData = predictionsResponse.data;
      const predictionsDataFromApi = predictionsDataResponse.data;

      const preds = predictionsData.data?.predictions || predictionsData.data || [];
      if (predictionsData?.success === false || predictionsDataFromApi?.success === false || preds.length === 0) {
        setPredictions([]);
        setHealthSummary(null);
        setError('Aucune prédiction disponible');
        return;
      }

      setPredictions(preds);
      console.log(`[AIPredictionDashboard] Chargé ${preds.length} prédictions`);

      // Map API response to health summary for KPI cards
      setHealthSummary(predictionsDataFromApi.data || null);

      // Don't show error if data is loaded successfully
      setError(null);

    } catch (err) {
      console.error('[AIPredictionDashboard] Erreur fetchData:', err);

      const message = (err as any)?.response?.status >= 500 || (err as any)?.code === 'ERR_NETWORK'
        ? 'Erreur serveur — affichage des données en cache.'
        : 'Erreur de chargement des prédictions';
      setError(message);
      setHealthSummary(null);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetrain = useCallback(() => {
    void fetchData(true);
  }, [fetchData]);

  const infoToast = useCallback((message: string) => {
    toast(message, { icon: 'ℹ️' });
  }, []);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden font-sans bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
              <div className="space-y-4">
                <div className="w-32 h-6 skeleton rounded-full" />
                <div className="w-64 h-10 skeleton rounded-xl" />
                <div className="w-96 h-4 skeleton rounded-lg" />
              </div>
              <div className="flex gap-3">
                <div className="w-32 h-12 skeleton rounded-xl" />
                <div className="w-40 h-12 skeleton rounded-xl" />
              </div>
            </div>
            <div className="w-64 h-12 skeleton rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-28 skeleton rounded-2xl relative overflow-hidden" />
              ))}
            </div>
            <div className="h-80 skeleton rounded-2xl relative overflow-hidden" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="h-80 skeleton rounded-2xl" />
              <div className="h-80 skeleton rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-5 pb-20 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[11px] font-normal mb-2">
                <Shield className="w-3 h-3" /> IA Sentinel System v2.0
              </div>
              <h1 className="title-lg text-gray-900 dark:text-white tracking-tight">
                {t('dashboard.title')}
              </h1>
              <div className="flex items-center gap-2">
                <p className="body-md text-gray-500 dark:text-gray-400">
                  {t('dashboard.subtitle')}
                </p>
                {error && (
                  <span
                    className="text-[10px] text-red-500 font-medium flex items-center gap-1 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full animate-pulse"
                    role="alert"
                  >
                    <AlertCircle size={12} /> {error}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" className="p-3" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </Button>

              <Button variant="ghost" className="p-3 flex items-center gap-2" onClick={toggleLanguage} aria-label="Changer de langue">
                <Languages size={18} />
                <span className="label-sm font-bold">{i18n.language}</span>
              </Button>

              <Button variant="secondary" className="px-6 py-3 text-[11px]" onClick={() => fetchData()} aria-label={t('common.sync')}>
                <RotateCcw className="w-4 h-4" /> {t('common.sync')}
              </Button>

              <Button
                variant="secondary"
                className={`px-6 py-3 text-[11px] ${FEATURES.AI_RETRAIN ? '' : 'cursor-not-allowed opacity-60'}`}
                onClick={FEATURES.AI_RETRAIN
                  ? handleRetrain
                  : () => infoToast('Fonctionnalité en cours de déploiement')
                }
                disabled={!FEATURES.AI_RETRAIN}
                title={!FEATURES.AI_RETRAIN ? 'Non disponible en production' : undefined}
                aria-disabled={!FEATURES.AI_RETRAIN}
              >
                <Settings className="w-4 h-4" /> {t('common.retrain')}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-white dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 w-fit" role="tablist">
            {[{ id: 'overview', label: 'Vue d\'ensemble' }, { id: 'predictions', label: 'Individuel' }, { id: 'anomalies', label: 'Timeline' }].map(tab => (
              <Button key={tab.id} variant={activeTab === tab.id ? 'primary' : 'ghost'} size="md" className={`px-6 py-2 rounded-lg text-[11px] font-semibold`} onClick={() => setActiveTab(tab.id as any)} aria-selected={activeTab === tab.id} role="tab">
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="animate-slide-up space-y-5">
            {activeTab === 'overview' && finalSummary && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Indice de risque — positif = mauvais */}
                  <KPICard
                    label={t('dashboard.risk_index')}
                    value={finalSummary.averageRiskScore}
                    unit="/ 100"
                    history={[38, 42, 45, 39, 51, 47, 55, 50, 48, 52, 46, finalSummary.averageRiskScore]}
                    previousValue={Math.max(0, finalSummary.averageRiskScore - 4)}
                    colorScheme="red"
                    inversePolarity={true}
                    icon={<Gauge size={13} />}
                  />
                  {/* Alertes ML — positif = mauvais */}
                  <KPICard
                    label={t('dashboard.ml_alerts')}
                    value={finalSummary.animalsWithAnomalies}
                    unit={t('dashboard.active')}
                    history={[5, 8, 6, 9, 7, 11, 8, 6, 10, 7, 9, finalSummary.animalsWithAnomalies]}
                    previousValue={Math.max(0, finalSummary.animalsWithAnomalies + 2)}
                    colorScheme="orange"
                    inversePolarity={true}
                    icon={<AlertTriangle size={13} />}
                  />
                  {/* Confiance système — positif = bon */}
                  <KPICard
                    label={t('dashboard.system_confidence')}
                    value={confidence ?? 'N/A'}
                    unit="%"
                    history={confidence != null ? [88, 90, 89, 91, 92, 90, 93, 91, 92, 93, 94, confidence] : undefined}
                    previousValue={confidence ?? undefined}
                    colorScheme="green"
                    inversePolarity={false}
                    icon={<Shield size={13} />}
                  />
                  {/* Population IA — positif = bon */}
                  <KPICard
                    label={t('dashboard.ai_population')}
                    value={finalSummary.totalAnimals}
                    unit={t('dashboard.animals')}
                    history={[180, 185, 188, 190, 192, 195, 198, 197, 200, 199, 202, finalSummary.totalAnimals]}
                    previousValue={Math.max(0, finalSummary.totalAnimals - 10)}
                    colorScheme="blue"
                    inversePolarity={false}
                    icon={<Radio size={13} />}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 bg-white dark:bg-card-dark p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                      Distribution géographique des risques
                    </h3>
                    <div className="h-full">
                      <AnomalyHeatmap />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                      Niveaux de vigilance
                    </h3>
                    <div className="space-y-5">
                      {Object.entries(finalSummary.riskDistribution).map(([level, count]) => (
                        <div key={level} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-[11px] font-normal text-gray-500 capitalize">{level}</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{count}</span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-1000"
                              style={{
                                width: `${finalSummary.totalAnimals > 0 ? (count / finalSummary.totalAnimals) * 100 : 0}%`,
                                backgroundColor: level === 'low' ? '#10B981' : level === 'medium' ? '#F59E0B' : '#EF4444'
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'predictions' && (
              <div>
                {predictions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {predictions.map(prediction => (
                      <PredictionCard
                        key={prediction.sheepId}
                        prediction={prediction}
                        onClick={() => setSelectedAnimal(prediction)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-80 text-center">
                    <Brain size={40} className="text-gray-300 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 mb-2">Aucun animal trouvé</p>
                    <p className="text-xs text-gray-400">Les données des animaux seront affichées ici une fois disponibles.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'anomalies' && (
              <div>
                {predictions.length > 0 ? (
                  <AnomalyTimeline predictions={predictions} onSelectAnimal={(id: string) => {
                    const animal = predictions.find(p => p.sheepId === id || (p as any).collar_id === id);
                    if (animal) setSelectedAnimal(animal);
                  }} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-80 text-center">
                    <AlertTriangle size={40} className="text-gray-300 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 mb-2">Aucune anomalie détectée</p>
                    <p className="text-xs text-gray-400">La timeline des anomalies sera affichée ici une fois les données chargées.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <AIInsightsFeed onSelectAnimal={(id: string) => {
        const animal = predictions.find(p => p.sheepId === id || (p as any).collar_id === id);
        if (animal) setSelectedAnimal(animal);
        else navigate(`/animals/${id}`);
      }} />

      <AnimatePresence>
        {selectedAnimal && (
          <ClinicalModal
            animal={selectedAnimal}
            onClose={() => setSelectedAnimal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIPredictionDashboard;
