import React, { useState, useEffect, useCallback } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudOff, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import logger from '../../utils/logger';
import { devLog } from '../../utils/devLogger';
import { isDevMockUserActive } from '../../utils/authStorage';
import DevBanner from '../../components/DevBanner';
import { useMqtt } from '../../contexts/MqttContext';
import { useIoTStore } from '../../hooks/useIoTStore';
import { PERSISTENCE_MODE } from '../../services/animalsService';
import animalsService from '../../services/animalsService';
import telemetryService from '../../services/telemetryService';
import ToastProvider from '../ui/ToastProvider';
import TopBar from './TopBar';
import { GlobalSearch, useGlobalSearch } from '../ui/GlobalSearch';
import Button from '../ui/Button';
import { ROUTE_META, buildBreadcrumbs, getRouteMeta, PILLAR_LABELS } from '../../config/routes';

const normalizeRole = (role?: string | null) => (role ?? '').trim().toLowerCase();

const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();
  const { user } = useAuth();
  const { isConnected } = useMqtt();
  const setDevices = useIoTStore(state => state.setDevices);
  const setAlerts = useIoTStore(state => state.setAlerts);
  const alerts = useIoTStore(state => state.alerts);
  const isOfflineData = useIoTStore(state => state.isOfflineData);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // --- Offline & PWA Logic ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setLastSyncTime(new Date().toLocaleTimeString());
    };
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show install button after 30s delay as requested
      setTimeout(() => setShowInstallBtn(true), 30000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    }
  };

  // Memoize the initData function to prevent infinite loops
  const initData = useCallback(async () => {
    devLog('[AppLayout] Initializing data...');
    try {
      const [devicesData, alertsData] = await Promise.all([
        (PERSISTENCE_MODE === 'api'
          ? animalsService.getAll().catch(err => {
            logger.warn('[AppLayout] getAll failed:', err);
            return [];
          })
          : telemetryService.getAnimals().catch(err => {
            logger.warn('[AppLayout] getAnimals failed:', err);
            return [];
          })),
        telemetryService.getAlerts().catch(err => {
          logger.warn('[AppLayout] getAlerts failed:', err);
          return [];
        })
      ]);

      devLog('[AppLayout] Received devices:', devicesData?.length, 'alerts:', alertsData?.length);

      // Convert array to Record for store
      const devicesMap: Record<string, any> = {};
      if (Array.isArray(devicesData)) {
        devicesData.forEach(d => {
          if (d && d.collar_id) {
            const refreshedAt = new Date().toISOString();
            devicesMap[d.collar_id] = {
              ...d,
              lastSeen: d.lastSeen || d.lastUpdate || d.updatedAt || refreshedAt,
              lastUpdate: d.lastUpdate || d.lastSeen || d.updatedAt || refreshedAt,
              updatedAt: d.updatedAt || d.lastUpdate || d.lastSeen || refreshedAt,
              timestamp: Date.now(),
            };
          }
        });
      }

      setDevices(devicesMap);
      if (Array.isArray(alertsData)) {
        setAlerts(alertsData);
      }
      devLog('[AppLayout] Data initialized successfully');
    } catch (error) {
      logger.warn('[AppLayout] Initial data sync failed', error);
    }
  }, [setDevices, setAlerts]);

  // Call initData once when user is available
  useEffect(() => {
    if (user) {
      const start = async () => {
        if (PERSISTENCE_MODE === 'api' && typeof indexedDB !== 'undefined') {
          try {
            await new Promise<void>((resolve) => {
              const request = indexedDB.deleteDatabase('SmartShepherdDB');
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            });
          } catch (error) {
            devLog('[AppLayout] IndexedDB cleanup skipped:', error);
          }
        }

        if (PERSISTENCE_MODE !== 'api') {
          // Keep offline fallback only for local persistence mode.
          await useIoTStore.getState().loadOfflineData();
        }

        // Then try to fetch live data
        initData();
      };
      start();
    }
  }, [user, initData]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const unreadCount = (alerts || []).filter(a => a && !a.read).length;
  const routeMeta = ROUTE_META[pathname] ?? ROUTE_META['/'];
  const page = {
    title: routeMeta.title,
    sub: routeMeta.subtitle,
  };
  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--page-bg)] font-sans transition-colors duration-300 dark:bg-[var(--page-bg-dark)]">
      {/* Toast Notifications */}
      <ToastProvider />

      {import.meta.env.DEV && isDevMockUserActive() && <DevBanner />}

      {/* Global Search Overlay (portal) */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="flex min-h-0 w-full flex-1 overflow-hidden">

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out`}>
          <Sidebar onClose={() => setIsSidebarOpen(false)} />
        </div>

        <div className="flex flex-col flex-1 overflow-hidden w-full">
          <TopBar
            title={page.title}
            subtitle={page.sub}
            unreadCount={unreadCount}
            isConnected={isConnected}
            isOfflineData={isOfflineData}
            onMenuClick={() => setIsSidebarOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenAlerts={() => navigate('/alerts')}
            installAction={showInstallBtn ? (
              <Button
                onClick={handleInstallClick}
                variant="ghost"
                size="sm"
                className="hidden lg:inline-flex items-center gap-2 border border-[var(--card-border)] px-3 py-2 text-[12px] text-[var(--text-secondary)] hover:border-[#c8dfd6] hover:text-[var(--text-primary)]"
              >
                <Download size={14} /> Installer l'app
              </Button>
            ) : undefined}
            userName={user?.name || 'Utilisateur'}
            roleLabel={normalizeRole(user?.role) === 'super_admin' ? 'Super admin' : normalizeRole(user?.role) === 'admin' ? 'Administrateur' : 'Observateur'}
          />

          <div className="border-b border-[var(--card-border)] bg-white px-4 py-2 text-[11px] text-[var(--text-muted)] dark:bg-[var(--card-bg)] md:px-8">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 overflow-hidden">
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 && <span className="text-[var(--text-muted)]/60">/</span>}
                  {crumb.href && !crumb.current ? (
                    <Link to={crumb.href} className="truncate font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="truncate font-medium text-[var(--text-primary)]">
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              ))}
              <span className="ml-2 rounded-full bg-[var(--brand-light)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-dark)]">
                {PILLAR_LABELS[routeMeta.pillar]}
              </span>
            </nav>
          </div>

          {/* Offline Banner */}
          <AnimatePresence>
            {!isOnline && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="z-20 flex items-center justify-center gap-3 overflow-hidden border-b border-[var(--card-border)] bg-[var(--warning-bg)] px-4 py-2 text-[11px] font-medium text-[var(--warning)]"
              >
                <CloudOff size={14} />
                <span>Mode hors-ligne — Données du {lastSyncTime}</span>
                <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content Area */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[var(--page-bg)] p-4 transition-colors duration-300 md:p-8 dark:bg-[var(--page-bg-dark)]">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
