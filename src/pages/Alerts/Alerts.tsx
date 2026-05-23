import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, CheckCircle, Filter, CheckCheck } from 'lucide-react';
import { useIoTStore, Alert } from '../../hooks/useIoTStore';
import { useAuth } from '../../contexts/AuthContext';
import { connectSocket, disconnectSocket, socket } from '../../services/socket';
import AlertRow from '../../components/ui/AlertRow';

export default function Alerts() {
  const { token } = useAuth();
  const alerts = useIoTStore(state => state.alerts);
  const addAlert = useIoTStore(state => state.addAlert);
  const markAlertAsRead = useIoTStore(state => state.markAlertAsRead);
  const markAllAlertsAsRead = useIoTStore(state => state.markAllAlertsAsRead);
  const [filterType, setFilterType] = useState<string>('ALL');
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('filter') === 'critical') {
      setFilterType('CRITICAL');
    }
  }, [location]);

  useEffect(() => {
    if (!token) return;

    connectSocket(token);

    const onNewAlert = (alertData: any) => {
      const rawType = (alertData?.type || alertData?.alert?.type || 'HEALTH_WARNING').toString();
      const normalizedType = rawType.toUpperCase();
      const rawSeverity = (alertData?.severity || alertData?.alert?.severity || 'WARNING').toString().toUpperCase();
      const normalizedSeverity: Alert['severity'] =
        rawSeverity === 'CRITICAL' ? 'CRITICAL' : rawSeverity === 'INFO' ? 'INFO' : 'WARNING';

      const collarId = (alertData?.collar_id || alertData?.deviceId || alertData?.collarId || 'N/A').toString();

      const incomingAlert: Alert = {
        id: alertData?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: normalizedType,
        collar_id: collarId,
        animal_name: alertData?.animal_name || alertData?.animalName || alertData?.name || `Collier ${collarId}`,
        severity: normalizedSeverity,
        timestamp: alertData?.timestamp ? new Date(alertData.timestamp).toISOString() : new Date().toISOString(),
        read: false,
        message: alertData?.message || alertData?.description,
        source: 'socket',
      };

      addAlert(incomingAlert);
    };

    socket.off('new_alert', onNewAlert);
    socket.on('new_alert', onNewAlert);

    return () => {
      socket.off('new_alert', onNewAlert);
      disconnectSocket();
    };
  }, [token, addAlert]);

  const filteredAlerts = alerts.filter(alert => {
    if (filterType === 'ALL') return true;
    if (filterType === 'CRITICAL') return alert.severity === 'CRITICAL';
    return alert.type === filterType;
  });

  const unreadCount = alerts.filter(a => !a.read).length;

  const getAlertLabel = (type: string) => {
    switch (type) {
      case 'OUT_OF_ZONE': return 'Sortie de zone détectée';
      case 'LOW_BATTERY': return 'Batterie critique';
      case 'HEALTH_WARNING': return 'Alerte santé';
      case 'COLLAR_OFFLINE': return 'Collier hors ligne';
      default: return 'Alerte';
    }
  };

  const getAlertDescription = (alert: Alert) => {
    switch (alert.type) {
      case 'OUT_OF_ZONE': return 'a quitté le périmètre de sécurité.';
      case 'LOW_BATTERY': return 'nécessite une recharge rapide du collier.';
      case 'HEALTH_WARNING': return 'présente des signes de santé préoccupants.';
      case 'COLLAR_OFFLINE': return 'a un collier qui ne répond plus.';
      default: return 'nécessite une attention.';
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Supervision</p>
          <h1 className="mt-1 flex items-center gap-2 text-[24px] font-medium leading-tight text-[var(--text-primary)]">
            <Bell className="h-6 w-6 text-[var(--brand-primary)]" /> Centre d'alertes
          </h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Gérez les notifications critiques du troupeau en temps réel.</p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAlertsAsRead}
              className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--card-border)] bg-white px-4 py-2 text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:border-[#c8dfd6] hover:bg-[#fafaf8] dark:bg-[var(--card-bg)]"
            >
              <CheckCheck className="h-4 w-4 text-[var(--brand-primary)]" />
              Tout marquer lu ({unreadCount})
            </button>
          )}

          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--card-border)] bg-white px-3 py-2 dark:bg-[var(--card-bg)]">
            <Filter className="h-4 w-4 text-[var(--text-muted)]" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="cursor-pointer bg-transparent pr-3 text-[12px] font-medium text-[var(--text-primary)] outline-none"
            >
              <option value="ALL">Toutes les alertes</option>
              <option value="CRITICAL">Alertes critiques</option>
              <option value="OUT_OF_ZONE">Sorties de zone</option>
              <option value="LOW_BATTERY">Batterie faible</option>
              <option value="HEALTH_WARNING">Santé</option>
              <option value="COLLAR_OFFLINE">Collier hors ligne</option>
            </select>
          </div>
        </div>
      </header>

      <div className="overflow-hidden rounded-[10px] border border-[var(--card-border)] bg-white dark:bg-[var(--card-bg)]">
        {filteredAlerts.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[10px] border border-[var(--card-border)] bg-[var(--success-bg)] text-[var(--success)]">
              <CheckCircle className="h-7 w-7" />
            </div>
            <h3 className="text-[14px] font-medium text-[var(--text-primary)]">Aucune alerte active</h3>
            <p className="mx-auto mt-2 max-w-xs text-[11px] text-[var(--text-muted)]">
              Tout semble normal pour le moment.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertRow
              key={alert.id}
              animal={alert.animal_name}
              detail={`L'animal ${alert.collar_id ? `Collier ${alert.collar_id}` : 'suivi'} · ${getAlertDescription(alert)}`}
              time={new Date(alert.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              severity={alert.severity === 'CRITICAL' ? 'critical' : alert.severity === 'WARNING' ? 'warning' : 'info'}
              unread={!alert.read}
              onClick={() => !alert.read && markAlertAsRead(alert.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
