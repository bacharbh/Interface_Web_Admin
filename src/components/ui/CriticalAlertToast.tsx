import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useIoTStore } from '../../hooks/useIoTStore';

/**
 * CriticalAlertToast — Mounts globally inside AppLayout.
 * Subscribes to the Zustand alerts array and triggers a visual toast
 * whenever a new CRITICAL alert is detected.
 * Uses a ref to track previously seen alert IDs to avoid re-toasting.
 */
export default function CriticalAlertToast() {
  const navigate = useNavigate();
  // Track the IDs of alerts we've already shown a toast for
  const seenIdsRef = useRef<Set<string | number>>(new Set());

  useEffect(() => {
    // Subscribe to the store — runs every time alerts array changes
    const unsubscribe = useIoTStore.subscribe(
      state => state.alerts,
      (alerts) => {
        alerts.forEach(alert => {
          // Only show toast for new, unread CRITICAL alerts we haven't seen
          if (
            alert.severity === 'CRITICAL' &&
            !alert.read &&
            !seenIdsRef.current.has(alert.id)
          ) {
            seenIdsRef.current.add(alert.id);

            toast.custom(
              (t) => (
                <div
                  className={`max-w-sm w-full bg-white dark:bg-gray-900 shadow-2xl shadow-red-500/20 rounded-2xl border-l-4 border-red-500 p-4 flex gap-3 items-start cursor-pointer transition-all ${t.visible ? 'animate-fade-in' : 'opacity-0'
                    }`}
                  onClick={() => {
                    navigate('/alerts');
                    toast.dismiss(t.id);
                  }}
                >
                  {/* Pulsing icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                    <span className="text-xl animate-bounce">🚨</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="label-xs text-red-600 dark:text-red-400 font-black">
                        Alerte critique
                      </p>
                      <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    </div>
                    <p className="title-sm text-gray-900 dark:text-white mt-0.5 truncate">
                      {alert.animal_name}
                    </p>
                    <p className="label-xs mt-0.5 font-bold">
                      {alert.type.replace(/_/g, ' ').toLowerCase()} · {alert.collar_id}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
                    className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none"
                  >×</button>
                </div>
              ),
              {
                duration: 5000,
                position: 'top-right',
              }
            );
          }
        });
      }
    );

    return unsubscribe;
  }, [navigate]);

  return null; // Purely side-effect component
}
