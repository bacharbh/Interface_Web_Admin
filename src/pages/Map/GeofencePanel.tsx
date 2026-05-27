import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Edit2, Flame, MapPinned, Shield, Trash2, Users, Zap } from 'lucide-react';
import Button from '../../components/ui/Button';
import { IAnimal, IGeofenceZone } from '../../types';

type ZoneSummary = IGeofenceZone & {
    animalCount: number;
};

interface GeofencePanelProps {
    zones: ZoneSummary[];
    selectedAnimal: IAnimal | null;
    alerts: Array<{ collar_id?: string; animal_id?: string; type?: string; severity?: string; createdAt?: string; message?: string; status?: string }>;
    onRenameZone: (zone: ZoneSummary, name: string) => void;
    onDeleteZone: (zone: ZoneSummary) => void;
}

const TYPE_META: Record<NonNullable<IGeofenceZone['type']>, { label: string; className: string; accent: string }> = {
    safe: {
        label: 'Safe',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
        accent: 'text-emerald-600',
    },
    exclusion: {
        label: 'Exclusion',
        className: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
        accent: 'text-amber-600',
    },
    alert: {
        label: 'Alert',
        className: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
        accent: 'text-red-600',
    },
};

const GeofencePanel = ({ zones, selectedAnimal, alerts, onRenameZone, onDeleteZone }: GeofencePanelProps) => {
    const [collapsed, setCollapsed] = useState(false);
    const [editingZoneId, setEditingZoneId] = useState<number | null>(null);
    const [draftName, setDraftName] = useState('');

    const totalAnimalsInZones = useMemo(() => zones.reduce((sum, zone) => sum + (zone.animalCount ?? 0), 0), [zones]);
    const selectedAlerts = useMemo(() => {
        if (!selectedAnimal) return alerts.slice(0, 4);

        return alerts
            .filter((alert) => alert.collar_id === selectedAnimal.collar_id || alert.animal_id === selectedAnimal.collar_id)
            .slice(0, 4);
    }, [alerts, selectedAnimal]);

    const startRename = (zone: ZoneSummary) => {
        setEditingZoneId(zone.id);
        setDraftName(zone.name);
    };

    const saveRename = (zone: ZoneSummary) => {
        const nextName = draftName.trim();
        if (!nextName || nextName === zone.name) {
            setEditingZoneId(null);
            return;
        }

        onRenameZone(zone, nextName);
        setEditingZoneId(null);
    };

    if (collapsed) {
        return (
            <aside className="flex h-full w-full flex-col items-center justify-between rounded-3xl border border-gray-200 bg-white/90 px-3 py-4 shadow-xl backdrop-blur dark:border-gray-800 dark:bg-card-dark/95">
                <button className="rounded-2xl border border-gray-200 bg-white p-2 text-gray-600 shadow-sm transition-colors hover:border-primary hover:text-primary dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300" onClick={() => setCollapsed(false)} aria-label="Ouvrir le panneau des zones">
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex flex-col items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <MapPinned className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-500 [writing-mode:vertical-rl] rotate-180">
                        Zones
                    </span>
                </div>
                <div className="flex flex-col items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    <span>{zones.length}</span>
                    <span>{totalAnimalsInZones} suivis</span>
                </div>
            </aside>
        );
    }

    return (
        <aside className="flex h-full w-full flex-col gap-4 rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-xl backdrop-blur dark:border-gray-800 dark:bg-card-dark/95">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Context panel</p>
                    <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">Surveillance des zones</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {zones.length} zone{zones.length > 1 ? 's' : ''}, {totalAnimalsInZones} animal{totalAnimalsInZones > 1 ? 'aux' : ''} suivis
                    </p>
                </div>
                <Button variant="ghost" size="sm" className="rounded-2xl p-2" onClick={() => setCollapsed(true)} aria-label="Réduire le panneau des zones">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {selectedAnimal && (
                <section className="rounded-3xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm dark:border-gray-800 dark:from-gray-950 dark:to-gray-900">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">Sélection</p>
                            <h4 className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{selectedAnimal.name || selectedAnimal.collar_id}</h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedAnimal.breed || 'Sans race'} · {selectedAnimal.sector || 'Secteur inconnu'}</p>
                        </div>
                        <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                            <Shield className="h-5 w-5" />
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <Metric label="Statut" value={selectedAnimal.status || 'SAFE'} tone={selectedAnimal.status === 'CRITICAL' ? 'text-red-600 dark:text-red-300' : selectedAnimal.status === 'OUT_OF_ZONE' ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'} />
                        <Metric label="Batterie" value={`${selectedAnimal.battery ?? 0}%`} tone={(selectedAnimal.battery ?? 0) < 20 ? 'text-red-600 dark:text-red-300' : 'text-sky-600 dark:text-sky-300'} />
                        <Metric label="Temp." value={typeof selectedAnimal.temperature === 'number' ? `${selectedAnimal.temperature.toFixed(1)}°C` : 'n/a'} tone="text-gray-700 dark:text-gray-200" />
                        <Metric label="BPM" value={selectedAnimal.heartRate ? `${selectedAnimal.heartRate}` : 'n/a'} tone="text-gray-700 dark:text-gray-200" />
                    </div>

                    <div className="mt-4 rounded-2xl border border-gray-100 bg-white/80 p-3 dark:border-gray-800 dark:bg-gray-950/70">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                            <Flame className="h-3.5 w-3.5" />
                            Alertes récentes
                        </div>
                        {selectedAlerts.length > 0 ? (
                            <div className="mt-3 space-y-2">
                                {selectedAlerts.map((alert, index) => (
                                    <div key={`${alert.type || alert.severity || 'alert'}-${index}`} className="flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900/80">
                                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                                        <div>
                                            <p className="font-medium text-gray-800 dark:text-gray-200">{alert.message || alert.type || 'Alerte'}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{alert.severity || 'INFO'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Aucune alerte active pour cet animal.</p>
                        )}
                    </div>
                </section>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {zones.length === 0 ? (
                    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 text-center text-gray-500 dark:border-gray-800 dark:text-gray-400">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                            <MapPinned className="h-7 w-7" />
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Aucune zone</p>
                        <p className="mt-1 text-sm">Utilisez l’outil de dessin sur la carte pour créer une géofence.</p>
                    </div>
                ) : (
                    zones.map((zone) => {
                        const meta = TYPE_META[zone.type || 'safe'];
                        const isEditing = editingZoneId === zone.id;

                        return (
                            <div key={zone.id} className="rounded-3xl border border-gray-100 p-4 transition-colors hover:border-primary/20 dark:border-gray-800 dark:hover:border-primary/30">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <input
                                                    value={draftName}
                                                    onChange={(event) => setDraftName(event.target.value)}
                                                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                                    placeholder="Nom de la zone"
                                                    autoFocus
                                                />
                                                <div className="flex gap-2">
                                                    <Button variant="primary" size="sm" onClick={() => saveRename(zone)}>
                                                        Enregistrer
                                                    </Button>
                                                    <Button variant="secondary" size="sm" onClick={() => setEditingZoneId(null)}>
                                                        Annuler
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="truncate font-semibold text-gray-900 dark:text-white">{zone.name}</h4>
                                                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${meta.className}`}>
                                                        {meta.label}
                                                    </span>
                                                </div>
                                                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                    <Users className="h-4 w-4" />
                                                    <span>
                                                        {zone.animalCount} animal{zone.animalCount > 1 ? 'aux' : ''} dedans
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {!isEditing && (
                                    <div className="mt-4 flex items-center gap-2">
                                        <Button variant="ghost" size="sm" className="px-3" onClick={() => startRename(zone)}>
                                            <Edit2 className="h-4 w-4" />
                                            Renommer
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="px-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                            onClick={() => onDeleteZone(zone)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Supprimer
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </aside>
    );
};

const Metric = ({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) => (
    <div className="rounded-2xl border border-gray-100 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-950/60">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`mt-1 text-sm font-semibold ${tone}`}>{value}</p>
    </div>
);

export default GeofencePanel;
