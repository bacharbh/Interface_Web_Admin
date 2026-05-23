import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { ShieldAlert, CheckCircle } from 'lucide-react';
import { io } from 'socket.io-client';
import { getStoredToken } from '../../utils/authStorage';

interface Alert {
  _id: string;
  animalId: string;
  animal_name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  read: boolean;
  createdAt: string;
}

const getAlertLabel = (type: string) => {
  switch (type) {
    case 'OUT_OF_ZONE':
      return 'Sortie de zone détectée';
    case 'LOW_BATTERY':
      return 'Batterie critique';
    case 'HEALTH_WARNING':
      return 'Alerte santé';
    case 'COLLAR_OFFLINE':
      return 'Collier hors ligne';
    default:
      return 'Alerte';
  }
};

export default function AlertFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterRead, setFilterRead] = useState('false'); // Default to unread
  const [unreadCount, setUnreadCount] = useState(0);

  const observer = useRef<IntersectionObserver | null>(null);

  // IntersectionObserver to detect when the last element is visible
  const lastAlertElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => prevPage + 1);
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  const fetchAlerts = async (pageNum: number, reset = false) => {
    setLoading(true);
    try {
      const token = getStoredToken();
      let url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/alerts?page=${pageNum}&limit=20`;
      if (filterSeverity) url += `&severity=${filterSeverity}`;
      if (filterRead) url += `&read=${filterRead}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      const newAlerts = data.alerts || [];

      setAlerts((prev) => (reset ? newAlerts : [...prev, ...newAlerts]));
      setHasMore(newAlerts.length > 0 && data.pagination.page < data.pagination.pages);

      // Calculate local unread count
      if (reset) {
        setUnreadCount(newAlerts.filter((a: Alert) => !a.read).length);
      }
    } catch (err) {
      console.error('Failed to fetch alerts', err);
    } finally {
      setLoading(false);
    }
  };

  // Triggered when filters change
  useEffect(() => {
    setPage(1);
    fetchAlerts(1, true);
  }, [filterSeverity, filterRead]);

  // Triggered when page increments (Infinite Scroll)
  useEffect(() => {
    if (page > 1) {
      fetchAlerts(page, false);
    }
  }, [page]);

  // Real-time Push via WebSockets
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');

    socket.on('notification:new', (newAlert: Alert) => {
      // Add to list only if it passes the current filters
      const matchesSeverity = !filterSeverity || newAlert.severity === filterSeverity;
      const matchesRead = filterRead === '' || String(newAlert.read) === filterRead;

      if (matchesSeverity && matchesRead) {
        setAlerts((prev) => [newAlert, ...prev]);
      }

      if (!newAlert.read) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    socket.on('notification:read', ({ id }: { id: string }) => {
      setAlerts((prev) => prev.map(a => (a._id === id ? { ...a, read: true } : a)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    });

    return () => {
      socket.disconnect();
    };
  }, [filterSeverity, filterRead]);

  const markAsRead = async (id: string) => {
    try {
      const token = getStoredToken();
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/alerts/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      // The socket event will update the UI, but we can do it optimistically:
      setAlerts((prev) => prev.map(a => (a._id === id ? { ...a, read: true } : a)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  // React-window requires an inline row renderer component
  const Row = ({ index, style }: any) => {
    const alert = alerts[index];
    if (!alert) return null;

    return (
      <div style={style} className="pr-4 pb-2">
        <div
          ref={index === alerts.length - 1 ? lastAlertElementRef : null}
          className={`p-3 h-full rounded-xl border transition-all flex gap-3 ${alert.read ? 'bg-gray-50 dark:bg-gray-800/20 opacity-60 border-gray-100 dark:border-gray-800' : 'bg-white dark:bg-card-dark border-red-100 dark:border-red-900/30 shadow-sm'
            }`}
        >
          <div className={`p-2 rounded-lg flex-shrink-0 self-center ${alert.severity === 'CRITICAL' ? 'bg-red-50 dark:bg-red-500/10 text-red-600' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'}`}>
            <ShieldAlert size={16} />
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-0.5">
              <p className="title-sm text-gray-900 dark:text-white truncate">
                {alert.animal_name || `Collier ${alert.animalId.substring(0, 6)}`}
              </p>
              <span className="label-xs whitespace-nowrap ml-2">
                {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="label-xs truncate uppercase tracking-wider">{alert.type.replace('_', ' ')}</p>
          </div>

          {!alert.read && (
            <button
              onClick={() => markAsRead(alert._id)}
              className="self-center p-2 text-gray-400 hover:text-green-500 transition-colors"
              aria-label={`Marquer l'alerte ${getAlertLabel(alert.type)} comme lue`}
              title="Marquer comme lu"
            >
              <CheckCircle size={18} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col h-full overflow-hidden">
      <div className="p-4 md:p-6 pb-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="title-sm text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          Flux d'alertes
          {unreadCount > 0 && (
            <span className="bg-amber-100 dark:bg-amber-500/10 text-amber-600 label-xs px-2 py-0.5 rounded-full animate-scale-in">
              {unreadCount}
            </span>
          )}
        </h3>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            className="text-xs border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-primary outline-none"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
          >
            <option value="">Toutes gravités</option>
            <option value="CRITICAL">Critiques</option>
            <option value="HIGH">Hautes</option>
            <option value="MEDIUM">Moyennes</option>
          </select>

          <select
            className="text-xs border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-primary outline-none"
            value={filterRead}
            onChange={(e) => setFilterRead(e.target.value)}
          >
            <option value="">Tous statuts</option>
            <option value="false">Non lus</option>
            <option value="true">Lus</option>
          </select>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6" style={{ height: '400px' }}>
        {alerts.length === 0 && !loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
            <ShieldAlert size={32} className="text-gray-200 dark:text-gray-700 mb-3" />
            <p className="label-sm">Aucune alerte correspondante.</p>
          </div>
        ) : (
          <List
            height={360}
            itemCount={alerts.length}
            itemSize={76} // Fix height mapping to visual Row height
            width="100%"
            className="custom-scrollbar"
          >
            {Row}
          </List>
        )}

        {loading && (
          <div className="text-center py-2 text-xs text-primary animate-pulse">
            Chargement...
          </div>
        )}
      </div>
    </div>
  );
}
