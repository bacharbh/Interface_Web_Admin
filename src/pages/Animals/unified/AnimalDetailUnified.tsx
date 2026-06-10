import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Archive, ChevronLeft, ChevronRight, Clock, Download, FileText, Heart, MapPin, MoreVertical, Plus, Radio, Thermometer, Activity, Wind } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { useIoTStore } from '../../../hooks/useIoTStore';
import VitalBox from '../components/VitalBox';
import FileUpload from '../components/FileUpload';
import MiniGPSMap from '../components/MiniGPSMap';
import { findAnimalByIdentifier, normalizeAnimalRecord } from './animal.adapter';
import type { AnimalDocumentEntry, AnimalTimelineEntry, NormalizedAnimal } from './animal.types';

type UnifiedTab = 'vitals' | 'history' | 'documents' | 'notes';

interface AnimalDetailUnifiedProps {
    animalId?: string;
    source?: 'route' | 'modal';
}

const buildMockTimeline = (animal: NormalizedAnimal): AnimalTimelineEntry[] => [
    {
        id: `${animal.id}-vaccine`,
        date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'vaccine',
        title: 'Vaccination de suivi',
        description: `Mise à jour sanitaire pour ${animal.displayId}`,
        veterinarian: 'Dr. Bernard',
    },
    {
        id: `${animal.id}-alert`,
        date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        type: 'alert',
        title: 'Alerte de température',
        description: 'Détection d’une valeur hors seuil, à surveiller.',
    },
    {
        id: `${animal.id}-recovery`,
        date: new Date().toISOString(),
        type: 'recovery',
        title: 'Retour à la normale',
        description: 'Les indicateurs reviennent dans la plage cible.',
    },
];

const buildMockDocuments = (animal: NormalizedAnimal): AnimalDocumentEntry[] => [
    {
        id: `${animal.id}-doc-1`,
        name: `Dossier_${animal.displayId}.pdf`,
        type: 'pdf',
        uploadedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        size: 182000,
    },
    {
        id: `${animal.id}-doc-2`,
        name: `Certificat_Sante_${animal.displayId}.pdf`,
        type: 'pdf',
        uploadedAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
        size: 221000,
    },
];

const AnimalDetailUnified: React.FC<AnimalDetailUnifiedProps> = ({ animalId }) => {
    const params = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<UnifiedTab>('vitals');
    const [notes, setNotes] = useState('Notes cliniques et observations terrain.');
    const [notesLastEdited, setNotesLastEdited] = useState(new Date());
    const [exportingReport, setExportingReport] = useState(false);

    const devices = useIoTStore((state) => state.devices);
    const historyStore = useIoTStore((state) => state.history);
    const alerts = useIoTStore((state) => state.alerts);

    const effectiveId = animalId || params.id || '';

    const rawAnimal = useMemo(() => {
        const directMatch = effectiveId ? devices[effectiveId] : undefined;

        if (directMatch) {
            return directMatch;
        }

        return findAnimalByIdentifier(Object.values(devices), effectiveId);
    }, [devices, effectiveId]);

    const animal = useMemo(() => {
        return rawAnimal ? normalizeAnimalRecord(rawAnimal as any) : null;
    }, [rawAnimal]);

    const animalHistory = useMemo(() => {
        if (!animal) {
            return [];
        }

        const fromStore = historyStore[animal.id] || [];
        return fromStore;
    }, [animal, historyStore]);

    const animalAlerts = useMemo(() => {
        if (!animal) {
            return [];
        }

        return alerts.filter((alert) => alert.collar_id === animal.id).slice(0, 10);
    }, [alerts, animal]);

    const timeline = useMemo(() => (animal ? buildMockTimeline(animal) : []), [animal]);
    const documents = useMemo(() => (animal ? buildMockDocuments(animal) : []), [animal]);

    const handleDownloadReport = async () => {
        setExportingReport(true);
        try {
            await Promise.resolve();
        } finally {
            setExportingReport(false);
        }
    };

    const handlePrevAnimal = () => {
        navigate(-1);
    };

    const handleNextAnimal = () => {
        navigate(1);
    };

    if (!animal) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto" />
                    <p className="text-gray-500">Animal introuvable</p>
                    <Button variant="primary" onClick={() => navigate('/animals')}>
                        Retour à la liste
                    </Button>
                </div>
            </div>
        );
    }

    const battery = animal.battery ?? 0;
    const temperature = animal.temperature ?? null;
    const heartRate = animal.heartRate ?? null;
    const activity = animal.activity ?? null;
    const speed = animal.speed ?? 0;

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
            <div className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-100 dark:border-gray-800 px-6 py-4 rounded-b-2xl">
                <div className="flex items-center justify-between gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/animals')} className="flex items-center gap-2">
                        <ChevronLeft className="w-4 h-4" /> Retour
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handlePrevAnimal} title="Animal précédent">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleNextAnimal} title="Animal suivant">
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => navigate('/agenda')}>
                            <Plus className="w-4 h-4" /> Planifier visite
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handleDownloadReport} disabled={exportingReport}>
                            <Download className="w-4 h-4" /> {exportingReport ? 'Génération...' : 'Rapport'}
                        </Button>
                        <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-2xl shadow-lg text-white">
                                🐑
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-gray-900 dark:text-white">{animal.name}</h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {animal.displayId} • {animal.breed} • {animal.sector || 'Secteur non défini'}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">Source: {animal.source}</span>
                            <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">Colliers: {animal.historicalCollars.length || 0}</span>
                            <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">MAJ: {animal.lastUpdate || '—'}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-fit">
                        <div className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
                            <p className="text-[10px] uppercase tracking-widest text-gray-400">État</p>
                            <p className="font-bold text-gray-900 dark:text-white">{animal.health}</p>
                        </div>
                        <div className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
                            <p className="text-[10px] uppercase tracking-widest text-gray-400">Batterie</p>
                            <p className="font-bold text-gray-900 dark:text-white">{battery}%</p>
                        </div>
                        <div className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
                            <p className="text-[10px] uppercase tracking-widest text-gray-400">GPS</p>
                            <p className="font-bold text-gray-900 dark:text-white">{animal.lat?.toFixed(4) || '—'}</p>
                        </div>
                        <div className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
                            <p className="text-[10px] uppercase tracking-widest text-gray-400">Alertes</p>
                            <p className="font-bold text-gray-900 dark:text-white">{animalAlerts.length}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-6">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <VitalBox label="BPM" value={heartRate} unit="BPM" range={{ min: 70, max: 120 }} icon={<Heart className="w-5 h-5" />} />
                        <VitalBox label="Température" value={temperature} unit="°C" range={{ min: 38.5, max: 39.5 }} icon={<Thermometer className="w-5 h-5" />} />
                        <VitalBox label="Activité" value={activity} unit="%" range={{ min: 50, max: 100 }} icon={<Activity className="w-5 h-5" />} />
                        <VitalBox label="Vitesse" value={speed || 0} unit="km/h" range={{ min: 0, max: 10 }} icon={<Wind className="w-5 h-5" />} />
                    </div>

                    <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Vue historique</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Historique médical, documents et notes seront branchés progressivement.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {(['vitals', 'history', 'documents', 'notes'] as const).map((tab) => (
                                    <Button
                                        key={tab}
                                        variant={activeTab === tab ? 'primary' : 'secondary'}
                                        size="sm"
                                        onClick={() => setActiveTab(tab)}
                                    >
                                        {tab}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {activeTab === 'vitals' && (
                            <div className="space-y-3">
                                <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400">
                                    Zone pour graphiques temps réel, alarmes et courbes multi-capteurs.
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-4">BPM: {heartRate}</div>
                                    <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-4">Température: {temperature}°C</div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="space-y-4">
                                {timeline.map((entry) => (
                                    <div key={entry.id} className="flex gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                                        <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center border border-gray-200 dark:border-gray-700">
                                            <Clock className="w-4 h-4 text-gray-500" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between gap-4">
                                                <h3 className="font-semibold text-gray-900 dark:text-white">{entry.title}</h3>
                                                <span className="text-xs text-gray-400">{new Date(entry.date).toLocaleDateString('fr-FR')}</span>
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{entry.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'documents' && (
                            <div className="space-y-4">
                                <FileUpload onFilesUpload={() => undefined} />
                                <div className="space-y-3">
                                    {documents.map((document) => (
                                        <div key={document.id} className="flex items-center justify-between rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{document.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{(document.size / 1024).toFixed(0)} KB</p>
                                            </div>
                                            <Button variant="ghost" size="sm">
                                                <FileText className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'notes' && (
                            <div className="space-y-3">
                                <textarea
                                    value={notes}
                                    onChange={(event) => {
                                        setNotes(event.target.value);
                                        setNotesLastEdited(new Date());
                                    }}
                                    className="w-full min-h-40 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white"
                                />
                                <p className="text-xs text-gray-400">Dernière modification: {notesLastEdited.toLocaleTimeString('fr-FR')}</p>
                            </div>
                        )}
                    </div>
                </div>

                <aside className="space-y-6">
                    <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-emerald-500" />
                            <h2 className="font-bold text-gray-900 dark:text-white">Position & trace GPS</h2>
                        </div>
                        <MiniGPSMap animalId={animal.id} />
                        <div className="grid grid-cols-2 gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-3">Latitude: {animal.lat?.toFixed(5) || '—'}</div>
                            <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-3">Longitude: {animal.lng?.toFixed(5) || '—'}</div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <Radio className="w-4 h-4 text-violet-500" />
                            <h2 className="font-bold text-gray-900 dark:text-white">Alertes récentes</h2>
                        </div>
                        {animalAlerts.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Aucune alerte pour cet animal.</p>
                        ) : (
                            <div className="space-y-2">
                                {animalAlerts.map((alert) => (
                                    <div key={alert.id} className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-3 text-sm text-gray-600 dark:text-gray-300">
                                        {alert.type} • {new Date(alert.timestamp).toLocaleString('fr-FR')}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <Archive className="w-4 h-4 text-red-500" />
                            <h2 className="font-bold text-gray-900 dark:text-white">Actions métier</h2>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button variant="secondary" size="sm" onClick={() => navigate('/agenda')}>Planifier visite</Button>
                            <Button variant="secondary" size="sm" onClick={handleDownloadReport}>Télécharger rapport</Button>
                            <Button variant="ghost" size="sm">Archiver</Button>
                        </div>
                    </div>
                </aside>
            </section>
        </div>
    );
};

export default AnimalDetailUnified;
