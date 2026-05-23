import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudOff, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import logger from '../../utils/logger';
import { devLog } from '../../utils/devLogger';
import { isDevMockUserActive } from '../../utils/authStorage';
import { useMqtt } from '../../contexts/MqttContext';
import { useIoTStore } from '../../hooks/useIoTStore';
import telemetryService from '../../services/telemetryService';
import ToastProvider from '../ui/ToastProvider';
import TopBar from './TopBar';
import { GlobalSearch, useGlobalSearch } from '../ui/GlobalSearch';
import Button from '../ui/Button';

const normalizeRole = (role?: string | null) => (role ?? '').trim().toLowerCase();

const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();
  const { user } = useAuth();
  const { isConnected, isSimulation } = useMqtt();
  const setDevices = useIoTStore(state => state.setDevices);
  const setAlerts = useIoTStore(state => state.setAlerts);
  const alerts = useIoTStore(state => state.alerts);
  const isOfflineData = useIoTStore(state => state.isOfflineData);
  const navigate = useNavigate();
  const location = useLocation();

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
        telemetryService.getAnimals().catch(err => {
          logger.warn('[AppLayout] getAnimals failed:', err);
          return [];
        }),
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
          if (d && d.collar_id) devicesMap[d.collar_id] = d;
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
      if (isSimulation) {
        return;
      }

      const start = async () => {
        // Load offline data first for immediate view
        await useIoTStore.getState().loadOfflineData();
        // Then try to fetch live data
        initData();
      };
      start();
    }
  }, [user, isSimulation, initData]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const unreadCount = (alerts || []).filter(a => a && !a.read).length;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--page-bg)] font-sans transition-colors duration-300 dark:bg-[var(--page-bg-dark)]">
      {/* Toast Notifications */}
      <ToastProvider />

      {isDevMockUserActive() && (
        <div className="border-b border-[var(--card-border)] bg-[var(--warning-bg)] px-4 py-2 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--warning)]">
          DEV MODE - Mock user active; tokens stay out of localStorage and this banner never ships to production.
        </div>
      )}

      {/* Global Search Overlay (portal) */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

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
          title="Tableau de bord"
          subtitle="Ferme · Mis à jour il y a quelques secondes"
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
  );
};

export default AppLayout;
