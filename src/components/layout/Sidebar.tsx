import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, Shield, LayoutDashboard, MapPin, PawPrint, Bell, Brain, BarChart3, AlertTriangle, Tag, Cpu, Users, Settings, GitCompare, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useIoTStore } from '../../hooks/useIoTStore';
import Button from '../ui/Button';
import { ROUTE_META } from '../../config/routes';

const normalizeRole = (role?: string | null) => (role ?? '').trim().toLowerCase();

const getRoleLabel = (role?: string | null) => {
  const normalized = normalizeRole(role);

  if (normalized === 'admin' || normalized === 'super_admin') return 'Administrateur';
  if (normalized === 'operator') return 'Opérateur';
  if (normalized === 'viewer' || normalized === 'farmer') return 'Éleveur / observateur';
  return 'Utilisateur';
};

interface SidebarProps {
  onClose?: () => void;
}

const PILLARS = {
  operations: { label: 'Opérations', routes: ['/', '/map', '/troupeau', '/alerts', '/troupeau/compare', '/agenda'] },
  intelligence: { label: 'Intelligence', routes: ['/ai', '/analytics', '/anomalies', '/labelling'] },
  administration: { label: 'Gestion', routes: ['/hardware', '/users', '/settings'] },
} as const;

const ICONS = {
  'layout-dashboard': LayoutDashboard,
  'map-pin': MapPin,
  'paw': PawPrint,
  'bell': Bell,
  'brain': Brain,
  'chart-bar': BarChart3,
  'alert-triangle': AlertTriangle,
  'tag': Tag,
  'device-watch': Cpu,
  'users': Users,
  'settings': Settings,
  'git-compare': GitCompare,
  'calendar': Calendar,
} as const;

type RouteKey = keyof typeof ROUTE_META;

const getIcon = (icon: string) => ICONS[icon as keyof typeof ICONS] ?? LayoutDashboard;

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { logout, user } = useAuth();
  const alerts = useIoTStore(state => state.alerts);
  const unreadCount = alerts.filter(a => !a.read).length;
  const currentRole = normalizeRole(user?.role);
  const location = useLocation();
  const visiblePillars = Object.entries(PILLARS)
    .map(([key, pillar]) => ({
      key,
      ...pillar,
      routes: pillar.routes.filter((path) => (key !== 'administration' || ['admin', 'super_admin'].includes(currentRole))),
    }))
    .filter((pillar) => pillar.routes.length > 0);

  return (
    <aside className="flex h-full w-[200px] shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-white">
      <div className="border-b border-[var(--sidebar-border)] px-4 py-[18px]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-[var(--brand-primary)] text-white">
            <Shield className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium leading-tight text-white">Smart Shepherd</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-white/30">IoT Dashboard</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {visiblePillars.map((pillar) => (
          <div key={pillar.key} className="mb-4">
            <p className="px-2 pb-2 pt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--sidebar-text)]">
              {pillar.label}
            </p>
            <div className="space-y-[2px]">
              {pillar.routes.map((path) => {
                const meta = ROUTE_META[path as RouteKey];
                const Icon = getIcon(meta.icon);

                return (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center gap-2 rounded-[7px] px-2.5 py-[7px] text-[12.5px] transition-colors ${isActive
                        ? 'bg-[var(--sidebar-active-bg)] text-white'
                        : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={`h-[15px] w-[15px] shrink-0 ${isActive ? 'text-white' : 'text-white/80'}`} />
                        <span className="min-w-0 flex-1 truncate font-medium">{meta.title}</span>
                        {path === '/map' && <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />}
                        {path === '/alerts' && unreadCount > 0 && (
                          <span className="min-w-[28px] rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-center text-[9px] font-medium leading-none text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--sidebar-border)] p-2.5">
        <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--brand-primary)] text-[12px] font-medium text-white">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium leading-tight text-white">{user?.name || 'Utilisateur'}</p>
            <p className="truncate text-[10px] text-[var(--sidebar-text)]">{getRoleLabel(user?.role)}</p>
          </div>
        </div>
        <Button
          onClick={logout}
          variant="ghost"
          className="flex w-full items-center gap-2 px-2.5 py-2 text-[12px] text-[var(--sidebar-text)] hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          <span className="font-medium">Déconnexion</span>
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
