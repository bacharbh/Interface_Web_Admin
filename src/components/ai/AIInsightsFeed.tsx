import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIoTStore } from '../../hooks/useIoTStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  AlertTriangle,
  Battery,
  MapPinOff,
  Heart,
  ChevronRight,
  CheckCircle,
  Eye,
  Activity,
  Zap,
  Thermometer,
  Clock3,
} from 'lucide-react';

/**
 * Helper for relative time display
 */
const getRelativeTime = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours}h`;
};

const AIInsightsFeed = ({ onSelectAnimal, backendNote }: { onSelectAnimal?: (id: string) => void; backendNote?: string }) => {
  const navigate = useNavigate();
  const aiAlerts = useIoTStore(state => state.aiAlerts);
  const [filter, setFilter] = useState('all');
  const [scanCount, setScanCount] = useState(0);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [nextEvents, setNextEvents] = useState<any[]>([]);
  const prevAlertsLength = useRef(aiAlerts.length);

  // Sound and Counter effect
  useEffect(() => {
    setScanCount(aiAlerts.length);
    if (aiAlerts.length > 0 && aiAlerts.length !== prevAlertsLength.current) {
      setLastCheck(new Date().toLocaleTimeString());
    }
    prevAlertsLength.current = aiAlerts.length;
  }, [aiAlerts]);

  // Load next events from localStorage (simple integration)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vetEvents_v1');
      if (!raw) return;
      const all = JSON.parse(raw);
      const now = new Date();
      const next = (all || []).filter((e: any) => new Date(e.date + 'T' + e.time) > now).sort((a: any, b: any) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime()).slice(0, 2);
      setNextEvents(next);
    } catch (e) {
      console.error('Failed to load vet events', e);
    }
  }, [aiAlerts.length]);

  const filteredAlerts = aiAlerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'health') return alert.type === 'health' || alert.type === 'ai-analysis' || alert.behaviorType === 'TEMPERATURE_ANOMALY';
    if (filter === 'gps') return alert.type === 'gps' || alert.behaviorType === 'GPS_ANOMALY';
    if (filter === 'battery') return alert.type === 'battery';
    if (filter === 'behavior') return alert.type === 'behavior';
    return false;
  });

  const counts = {
    all: aiAlerts.length,
    health: aiAlerts.filter(a => a.type === 'health' || a.type === 'ai-analysis' || a.behaviorType === 'TEMPERATURE_ANOMALY').length,
    gps: aiAlerts.filter(a => a.type === 'gps' || a.behaviorType === 'GPS_ANOMALY').length,
    battery: aiAlerts.filter(a => a.type === 'battery').length,
    behavior: aiAlerts.filter(a => a.type === 'behavior').length,
  };

  const getAlertTone = (alert: any) => {
    if (alert.type === 'behavior') return 'bg-violet-50 dark:bg-violet-500/10 text-violet-500';
    if (alert.type === 'health') return 'bg-red-50 dark:bg-red-500/10 text-red-500';
    if (alert.type === 'battery') return 'bg-orange-50 dark:bg-orange-500/10 text-orange-500';
    return 'bg-blue-50 dark:bg-blue-500/10 text-blue-500';
  };

  const getAlertIcon = (alert: any) => {
    if (alert.type === 'behavior') {
      if (alert.behaviorType === 'IMMOBILITY') return <Clock3 size={12} />;
      if (alert.behaviorType === 'GPS_ANOMALY') return <MapPinOff size={12} />;
      return <Thermometer size={12} />;
    }
    return alert.type === 'health' ? <Heart size={12} /> : alert.type === 'battery' ? <Zap size={12} /> : <MapPinOff size={12} />;
  };

  const getEmptyStateMessage = () => {
    switch (filter) {
      case 'health':
        return { title: 'Aucune donnée IA', subtitle: 'Connectez le service IA pour recevoir des analyses santé.' };
      case 'gps':
        return { title: 'Aucune donnée IA', subtitle: 'Connectez le service IA pour recevoir des analyses GPS.' };
      case 'battery':
        return { title: 'Aucune donnée IA', subtitle: 'Connectez le service IA pour recevoir des analyses batterie.' };
      case 'behavior':
        return { title: 'Aucune donnée IA', subtitle: 'Connectez le service IA pour recevoir des analyses comportement.' };
      default:
        return { title: 'Aucune analyse IA', subtitle: 'En attente de données capteurs et du service IA.' };
    }
  };

  const emptyState = getEmptyStateMessage();

  return (
    <div className="w-96 bg-white dark:bg-card-dark border-l border-gray-100 dark:border-gray-800 flex flex-col h-full shadow-2xl relative font-sans">
      <div className="p-6 border-b border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="title-md text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="text-primary" size={20} /> AI Insights
          </h2>
          <div className="flex items-center gap-2">
            <span className="label-xs">Insights: {scanCount}</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        </div>
        {backendNote && (
          <div className="p-3 mb-4 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200">
            <p className="label-xs font-semibold mb-1">Limites backend</p>
            <p className="text-[11px] leading-5">{backendNote}</p>
          </div>
        )}
        {/* Next events (simple) */}
        {nextEvents.length > 0 && (
          <div className="p-3 mb-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">🗓️</div>
                <div>
                  <div className="label-sm font-bold">Prochains événements</div>
                  <div className="label-xs text-gray-500">2 prochains</div>
                </div>
              </div>
              <a href="/agenda" className="label-xs text-primary">Voir l'agenda complet</a>
            </div>
            <div className="space-y-2">
              {nextEvents.map(ev => (
                <div key={ev.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: ev.type === 'visit' ? '#378ADD' : ev.type === 'vaccine' ? '#1D9E75' : ev.type === 'treatment' ? '#EF9F27' : ev.type === 'deworming' ? '#7F77DD' : '#E24B4A' }} />
                    <div className="text-sm">
                      <div className="font-bold">{ev.title}</div>
                      <div className="label-xs text-gray-500">{ev.date} • {ev.time}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{ev.animals?.length || 0} animaux</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs with Badges */}
        <div className="flex gap-1 bg-gray-50 dark:bg-gray-800/50 p-1 rounded-xl">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'health', label: 'Santé' },
            { id: 'gps', label: 'GPS' },
            { id: 'battery', label: 'Batterie' },
            { id: 'behavior', label: 'Comportement' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-1 py-2 px-1 rounded-lg label-sm transition-all relative ${filter === tab.id
                ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab.label}
              {counts[tab.id as keyof typeof counts] > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 label-xs text-white ring-2 ring-white dark:ring-gray-900">
                  {counts[tab.id as keyof typeof counts]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => (
              <motion.div
                key={alert.id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  ...(alert.riskScore > 80 ? { x: [0, -1, 1, -1, 1, 0] } : {})
                }}
                exit={{ opacity: 0, x: 100 }}
                drag="x"
                dragConstraints={{ left: 0, right: 100 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 80) {
                    // dismiss logic
                  }
                }}
                className={`p-5 bg-white dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${alert.riskScore > 80 ? 'border-red-500/20' : ''
                  }`}
              >
                {/* Left Status Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${alert.riskScore > 80 ? 'bg-red-500' : alert.riskScore > 50 ? 'bg-orange-500' : 'bg-green-500'
                  }`} />

                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-xl shadow-sm">🐑</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="title-sm text-gray-900 dark:text-white">{alert.animalName}</p>
                        <div className={`p-1 rounded-md ${getAlertTone(alert)}`}>
                          {getAlertIcon(alert)}
                        </div>
                      </div>
                      <p className="label-xs">{getRelativeTime(alert.timestamp)}</p>
                    </div>
                  </div>
                </div>

                <p className="body-sm text-gray-600 dark:text-gray-300 mb-4">{alert.message}</p>
                <p className="label-xs mb-4 text-gray-400">
                  {new Date(alert.timestamp).toLocaleString('fr-FR')}
                </p>

                {/* Confidence Bar */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between label-xs">
                    <span>Niveau de confiance</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">{alert.riskScore}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${alert.riskScore}%` }}
                      className={`h-full rounded-full ${alert.riskScore > 80 ? 'bg-red-500' : alert.riskScore > 50 ? 'bg-orange-500' : 'bg-green-500'
                        }`}
                    />
                  </div>
                </div>

                <button
                  onClick={() => onSelectAnimal ? onSelectAnimal(alert.animalId) : navigate(`/animals/${alert.animalId}`)}
                  className="w-full py-2 bg-gray-900 dark:bg-primary text-white rounded-xl label-sm hover:bg-black dark:hover:bg-primary-dark transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Eye size={14} /> Voir l'animal
                </button>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center gap-4 py-20 px-6"
            >
              <div className="w-20 h-20 rounded-full bg-green-50 dark:bg-green-500/5 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                <CheckCircle className="w-10 h-10 text-green-500 relative z-10" />
              </div>
              <div>
                <h3 className="title-sm text-gray-900 dark:text-white">{emptyState.title}</h3>
                <p className="label-xs mt-1">
                  Dernière vérification : {lastCheck}<br />
                  {emptyState.subtitle}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AIInsightsFeed;
