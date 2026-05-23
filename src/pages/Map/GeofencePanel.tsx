import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit2, MapPinned, Trash2, Users } from 'lucide-react';
import Button from '../../components/ui/Button';
import { IGeofenceZone } from '../../types';

type ZoneSummary = IGeofenceZone & {
    animalCount: number;
};

interface GeofencePanelProps {
    zones: ZoneSummary[];
    onRenameZone: (zone: ZoneSummary, name: string) => void;
    onDeleteZone: (zone: ZoneSummary) => void;
}

const TYPE_META: Record<NonNullable<IGeofenceZone['type']>, { label: string; className: string }> = {
    safe: {
        label: 'Safe',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    },
    exclusion: {
        label: 'Exclusion',
        className: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    },
    alert: {
        label: 'Alert',
        className: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
    },
};

const GeofencePanel = ({ zones, onRenameZone, onDeleteZone }: GeofencePanelProps) => {
    const [collapsed, setCollapsed] = useState(false);
    const [editingZoneId, setEditingZoneId] = useState<number | null>(null);
    const [draftName, setDraftName] = useState('');

    const totalAnimalsInZones = useMemo(() => zones.reduce((sum, zone) => sum + (zone.animalCount ?? 0), 0), [zones]);

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
            <aside className="w-full xl:w-14 shrink-0 rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-card-dark xl:flex xl:flex-col xl:items-center xl:justify-between xl:py-4">
                <div className="flex items-center justify-between px-4 py-3 xl:flex-col xl:gap-4 xl:px-0 xl:py-0">
                    <Button variant="ghost" size="sm" className="p-2" onClick={() => setCollapsed(false)} aria-label="Ouvrir le panneau des zones">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 xl:flex-col xl:gap-2">
                        <MapPinned className="h-5 w-5 text-primary" />
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 xl:text-[10px] xl:font-black xl:uppercase xl:tracking-[0.2em] xl:[writing-mode:vertical-rl] xl:rotate-180">
                            Zones
                        </span>
                    </div>
                    <span className="text-xs font-semibold text-gray-500">{zones.length}</span>
                </div>
            </aside>
        );
    }

    return (
        <aside className="w-full xl:w-96 shrink-0 rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-card-dark flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Geofence Panel</p>
                    <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">Zones & surveillance</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {zones.length} zones, {totalAnimalsInZones} animal{totalAnimalsInZones > 1 ? 'aux' : ''} suivis
                    </p>
                </div>
                <Button variant="ghost" size="sm" className="p-2" onClick={() => setCollapsed(true)} aria-label="Réduire le panneau des zones">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {zones.length === 0 ? (
                    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 text-center text-gray-500 dark:border-gray-800 dark:text-gray-400">
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
                            <div key={zone.id} className="rounded-2xl border border-gray-100 p-4 transition-colors hover:border-primary/20 dark:border-gray-800 dark:hover:border-primary/30">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <input
                                                    value={draftName}
                                                    onChange={(event) => setDraftName(event.target.value)}
                                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
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

export default GeofencePanel;
