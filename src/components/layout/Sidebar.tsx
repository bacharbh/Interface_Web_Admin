import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map as MapIcon, Users, Activity, Bell, Settings, LogOut, Shield, Cpu, Brain, BarChart3, Stethoscope, AlertTriangle, LucideIcon } from 'lucide-react';
import { useAuth, USER_ROLES, UserRole } from '../../contexts/AuthContext';
import { useIoTStore } from '../../hooks/useIoTStore';
import Button from '../ui/Button';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
  live?: boolean;
  badge?: boolean;
}

const normalizeRole = (role?: string | null) => (role ?? '').trim().toLowerCase();

const getRoleLabel = (role?: string | null) => {
  const normalized = normalizeRole(role);

  if (normalized === 'admin' || normalized === 'super_admin') return 'Administrateur';
  if (normalized === 'operator') return 'Opérateur';
  if (normalized === 'viewer' || normalized === 'farmer') return 'Éleveur / observateur';
  return 'Utilisateur';
};

const navigationGroups = [
  {
    label: 'Principal',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'operator', 'viewer', 'super_admin'] },
      { name: 'Carte live', href: '/map', icon: MapIcon, roles: ['admin', 'operator', 'viewer', 'super_admin'], live: true },
      { name: 'Troupeau', href: '/animals', icon: Activity, roles: ['admin', 'operator', 'viewer', 'super_admin'] },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { name: 'IA', href: '/ai-dashboard', icon: Brain, roles: ['admin', 'operator', 'viewer', 'super_admin'] },
      { name: 'Analytique', href: '/analytics', icon: BarChart3, roles: ['admin', 'operator', 'viewer', 'super_admin'] },
      { name: 'Anomalies', href: '/anomalies', icon: AlertTriangle, roles: ['admin', 'operator', 'viewer', 'super_admin'] },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { name: 'Labelling', href: '/admin/labelling', icon: Stethoscope, roles: ['admin', 'super_admin'] },
      { name: 'Hardware', href: '/hardware', icon: Cpu, roles: ['admin', 'super_admin'] },
      { name: 'Alertes', href: '/alerts', icon: Bell, roles: ['admin', 'operator', 'viewer', 'super_admin'], badge: true },
      { name: 'Utilisateurs', href: '/users', icon: Users, roles: ['admin', 'super_admin'] },
      { name: 'Paramètres', href: '/settings', icon: Settings, roles: ['admin', 'super_admin'] },
    ],
  },
];

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { logout, user } = useAuth();
  const alerts = useIoTStore(state => state.alerts);
  const unreadCount = alerts.filter(a => !a.read).length;
  const currentRole = normalizeRole(user?.role);
  const visibleGroups = navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.roles.includes(currentRole)),
    }))
    .filter(group => group.items.length > 0);

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
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-2 pb-2 pt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--sidebar-text)]">
              {group.label}
            </p>
            <div className="space-y-[2px]">
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
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
                      <item.icon className={`h-[15px] w-[15px] shrink-0 ${isActive ? 'text-white' : 'text-white/80'}`} />
                      <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                      {(item as any).live && <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />}
                      {(item as any).badge && unreadCount > 0 && (
                        <span className="min-w-[28px] rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-center text-[9px] font-medium leading-none text-white">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
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
