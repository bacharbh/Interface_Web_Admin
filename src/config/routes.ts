import { Activity, AlertTriangle, BarChart3, Bell, Brain, Cpu, LayoutDashboard, Map as MapIcon, Settings, Stethoscope, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Pillar = 'operations' | 'intelligence' | 'administration';

export type RouteMeta = {
    title: string;
    subtitle: string;
    pillar: Pillar;
    icon: string;
};

export const ROUTE_META: Record<string, RouteMeta> = {
    '/': { title: 'Tableau de bord', subtitle: 'Vue opérationnelle', pillar: 'operations', icon: 'layout-dashboard' },
    '/dashboard': { title: 'Tableau de bord', subtitle: 'Vue opérationnelle', pillar: 'operations', icon: 'layout-dashboard' },
    '/map': { title: 'Carte live', subtitle: '200 animaux suivis', pillar: 'operations', icon: 'map-pin' },
    '/animals': { title: 'Troupeau', subtitle: 'Gestion du bétail', pillar: 'operations', icon: 'paw' },
    '/troupeau': { title: 'Troupeau', subtitle: 'Gestion du bétail', pillar: 'operations', icon: 'paw' },
    '/alerts': { title: 'Alertes', subtitle: 'Centre de triage', pillar: 'operations', icon: 'bell' },
    '/ai': { title: 'IA Predictions', subtitle: 'Analyse prédictive', pillar: 'intelligence', icon: 'brain' },
    '/ai-dashboard': { title: 'IA Predictions', subtitle: 'Analyse prédictive', pillar: 'intelligence', icon: 'brain' },
    '/analytics': { title: 'Analytique', subtitle: 'Historique tendances', pillar: 'intelligence', icon: 'chart-bar' },
    '/anomalies': { title: 'Anomalies', subtitle: 'Registre incidents', pillar: 'intelligence', icon: 'alert-triangle' },
    '/labelling': { title: 'Labelling', subtitle: 'Validation terrain', pillar: 'intelligence', icon: 'tag' },
    '/hardware': { title: 'Hardware', subtitle: 'Flotte colliers', pillar: 'administration', icon: 'device-watch' },
    '/users': { title: 'Utilisateurs', subtitle: 'Gestion des accès', pillar: 'administration', icon: 'users' },
    '/settings': { title: 'Paramètres', subtitle: 'Configuration système', pillar: 'administration', icon: 'settings' },
    '/agenda': { title: 'Agenda', subtitle: 'Planification des visites', pillar: 'operations', icon: 'calendar' },
};

export const ROUTES: Record<string, RouteMeta> = {
    ...ROUTE_META,
    '/admin/labelling': { title: 'Labelling', subtitle: 'Validation terrain', pillar: 'administration', icon: 'tag' },
};

export const PILLAR_LABELS: Record<Pillar, string> = {
    operations: 'Opérations',
    intelligence: 'Intelligence',
    administration: 'Administration',
};

export const PILLAR_HOME: Record<Pillar, string> = {
    operations: '/dashboard',
    intelligence: '/ai-dashboard',
    administration: '/users',
};

export interface BreadcrumbItem {
    label: string;
    href?: string;
    current?: boolean;
}

export interface SidebarItem {
    name: string;
    href: string;
    icon: LucideIcon;
    roles: string[];
    live?: boolean;
    badge?: boolean;
}

export interface SidebarGroup {
    label: string;
    pillar: Pillar;
    items: SidebarItem[];
}

export interface SearchPageItem {
    id: string;
    label: string;
    icon: string;
    path: string;
    keywords: string[];
}

export const SIDEBAR_GROUPS: SidebarGroup[] = [
    {
        label: 'Opérations',
        pillar: 'operations',
        items: [
            { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'operator', 'viewer', 'super_admin'] },
            { name: 'Carte live', href: '/map', icon: MapIcon, roles: ['admin', 'operator', 'viewer', 'super_admin'], live: true },
            { name: 'Troupeau', href: '/animals', icon: Activity, roles: ['admin', 'operator', 'viewer', 'super_admin'] },
            { name: 'Alertes', href: '/alerts', icon: Bell, roles: ['admin', 'operator', 'viewer', 'super_admin'], badge: true },
        ],
    },
    {
        label: 'Intelligence',
        pillar: 'intelligence',
        items: [
            { name: 'IA', href: '/ai-dashboard', icon: Brain, roles: ['admin', 'operator', 'viewer', 'super_admin'] },
            { name: 'Analytique', href: '/analytics', icon: BarChart3, roles: ['admin', 'operator', 'viewer', 'super_admin'] },
            { name: 'Anomalies', href: '/anomalies', icon: AlertTriangle, roles: ['admin', 'operator', 'viewer', 'super_admin'] },
        ],
    },
    {
        label: 'Administration',
        pillar: 'administration',
        items: [
            { name: 'Labelling', href: '/admin/labelling', icon: Stethoscope, roles: ['admin', 'super_admin'] },
            { name: 'Hardware', href: '/hardware', icon: Cpu, roles: ['admin', 'super_admin'] },
            { name: 'Utilisateurs', href: '/users', icon: Users, roles: ['admin', 'super_admin'] },
            { name: 'Paramètres', href: '/settings', icon: Settings, roles: ['admin', 'super_admin'] },
        ],
    },
];

export const SEARCH_PAGES: SearchPageItem[] = [
    { id: 'dashboard', label: ROUTE_META['/dashboard'].title, icon: '📊', path: '/dashboard', keywords: ['dashboard', 'tableau', 'accueil'] },
    { id: 'animals', label: 'Gestion du troupeau', icon: '🐑', path: '/animals', keywords: ['animaux', 'troupeau', 'colliers'] },
    { id: 'alerts', label: 'Centre d\'alertes', icon: '🔔', path: '/alerts', keywords: ['alertes', 'notifications', 'alarmes'] },
    { id: 'map', label: 'Carte live', icon: '🗺️', path: '/map', keywords: ['carte', 'map', 'gps', 'localisation'] },
    { id: 'analytics', label: 'Analytiques', icon: '📈', path: '/analytics', keywords: ['stats', 'analytics', 'données', 'graphiques'] },
    { id: 'ai', label: 'IA Prédictive', icon: '🤖', path: '/ai-dashboard', keywords: ['ia', 'ai', 'prédiction', 'intelligence'] },
    { id: 'hardware', label: 'Matériel & Colliers', icon: '📡', path: '/hardware', keywords: ['matériel', 'hardware', 'colliers', 'iot'] },
    { id: 'settings', label: 'Paramètres', icon: '⚙️', path: '/settings', keywords: ['paramètres', 'configuration', 'réglages'] },
    { id: 'users', label: 'Utilisateurs', icon: '👥', path: '/users', keywords: ['utilisateurs', 'users', 'comptes', 'équipe'] },
];

function normalizePath(pathname: string) {
    if (pathname.length > 1 && pathname.endsWith('/')) {
        return pathname.slice(0, -1);
    }

    return pathname;
}

export function getRouteMeta(pathname: string): RouteMeta {
    const normalizedPath = normalizePath(pathname);

    if (ROUTES[normalizedPath as keyof typeof ROUTES]) {
        return ROUTES[normalizedPath as keyof typeof ROUTES];
    }

    const exactMatch = Object.keys(ROUTES)
        .filter((route) => normalizedPath === route || normalizedPath.startsWith(`${route}/`))
        .sort((left, right) => right.length - left.length)[0];

    return exactMatch ? ROUTES[exactMatch as keyof typeof ROUTES] : ROUTES['/'];
}

export function getRouteSubtitle(pathname: string) {
    const normalizedPath = normalizePath(pathname);
    if (ROUTE_META[normalizedPath]) {
        return ROUTE_META[normalizedPath].subtitle;
    }

    return ROUTE_META['/'].subtitle;
}

export function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
    const normalizedPath = normalizePath(pathname);
    const meta = getRouteMeta(normalizedPath);
    const homePath = PILLAR_HOME[meta.pillar];

    if (normalizedPath === '/' || normalizedPath === homePath) {
        return [{ label: meta.title, current: true }];
    }

    return [
        { label: PILLAR_LABELS[meta.pillar], href: homePath },
        { label: meta.title, current: true },
    ];
}