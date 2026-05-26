import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArrowLeft,
    AlertCircle,
    Archive,
    Battery,
    Calendar,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    Edit2,
    FileText,
    Heart,
    Loader2,
    MapPin,
    MoreVertical,
    Plus,
    Thermometer,
    Trash2,
    Upload,
    Wind,
    Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from '../../components/ui/Button';
import { useIoTStore } from '../../hooks/useIoTStore';
import animalsService from '../../services/animalsService';
import { downloadPDFReport } from '../../services/excelExport';
import VitalBox from './components/VitalBox';
import MiniGPSMap from './components/MiniGPSMap';
import {
    allowedDocumentExtensions,
    allowedDocumentMimeTypes,
    createMedicalHistoryRecord,
    deleteAnimalDocument,
    fetchAnimalDocuments,
    fetchMedicalHistory,
    getDocumentTypeFromFile,
    maxDocumentSizeBytes,
    MedicalHistoryInput,
    MedicalHistoryRecord,
    MedicalHistoryType,
    patchAnimalNotes,
    uploadAnimalDocument,
    AnimalDocumentRecord,
} from '../../services/animalProfileService';

type ProfileTab = 'vitals' | 'history' | 'documents' | 'notes';
type NotesSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface HealthColor {
    text: string;
    bg: string;
    border: string;
}

interface TabBoundaryProps {
    children: React.ReactNode;
    fallback: React.ReactNode;
}

interface TabBoundaryState {
    hasError: boolean;
}

interface HistoryFormState extends MedicalHistoryInput { }

const HISTORY_TYPE_OPTIONS: Array<{ value: MedicalHistoryType; label: string; description: string }> = [
    { value: 'vaccine', label: 'Vaccin', description: 'Injection ou rappel vaccinal' },
    { value: 'treatment', label: 'Traitement', description: 'Médication ou soin' },
    { value: 'exam', label: 'Examen', description: 'Contrôle clinique' },
];

const MEDICAL_HISTORY_BADGES: Record<MedicalHistoryType, { label: string; icon: string; className: string }> = {
    vaccine: { label: 'Vaccin', icon: '💉', className: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20' },
    treatment: { label: 'Traitement', icon: '💊', className: 'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20' },
    exam: { label: 'Examen', icon: '🩺', className: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20' },
};

const DOCUMENT_BADGES: Record<string, { label: string; className: string }> = {
    pdf: { label: 'PDF', className: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20' },
    jpg: { label: 'JPG', className: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20' },
    jpeg: { label: 'JPG', className: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20' },
    png: { label: 'PNG', className: 'bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20' },
};

const TAB_META: Record<ProfileTab, { label: string; icon: React.ReactNode }> = {
    vitals: { label: 'Vitaux', icon: <Heart className="w-4 h-4" /> },
    history: { label: 'Historique', icon: <Calendar className="w-4 h-4" /> },
    documents: { label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    notes: { label: 'Notes', icon: <Edit2 className="w-4 h-4" /> },
};

const VITALS = [
    { label: 'BPM', key: 'heartRate' as const, unit: 'BPM', min: 70, max: 120, icon: <Heart className="w-5 h-5" /> },
    { label: 'Température', key: 'temperature' as const, unit: '°C', min: 38.5, max: 39.5, icon: <Thermometer className="w-5 h-5" /> },
    { label: 'Activité', key: 'activity' as const, unit: '%', min: 50, max: 100, icon: <Wind className="w-5 h-5" /> },
    { label: 'Batterie', key: 'battery' as const, unit: '%', min: 20, max: 100, icon: <Battery className="w-5 h-5" /> },
];

const PROFILE_ERROR_MESSAGE = 'Une erreur est survenue dans cet onglet.';

class TabErrorBoundary extends React.Component<TabBoundaryProps, TabBoundaryState> {
    constructor(props: TabBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error('[AnimalProfile] Tab crash:', error);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }

        return this.props.children;
    }
}

const EmptyHistory = ({ onReset }: { onReset: () => void }) => (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white text-center dark:border-gray-800 dark:bg-gray-900/40">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary">
            <Calendar className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Aucun historique médical</h3>
        <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Ajoutez un premier événement pour conserver le suivi vétérinaire de cet animal.
        </p>
        <Button variant="secondary" className="mt-5" onClick={onReset}>
            Réinitialiser le formulaire
        </Button>
    </div>
);

const EmptyDocuments = ({ onUpload }: { onUpload: () => void }) => (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white text-center dark:border-gray-800 dark:bg-gray-900/40">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary">
            <Upload className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Aucun document</h3>
        <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Déposez un PDF, JPG ou PNG pour l’attacher au dossier de l’animal.
        </p>
        <Button variant="primary" className="mt-5" onClick={onUpload}>
            Ajouter un document
        </Button>
    </div>
);

const TabCrashFallback = ({ title }: { title: string }) => (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm">{PROFILE_ERROR_MESSAGE}</p>
    </div>
);

const formatDate = (date: string) =>
    new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));

const formatTime = (date: Date) =>
    new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);

const formatDocumentSize = (size: number) => {
    if (!Number.isFinite(size) || size <= 0) {
        return '0 KB';
    }

    const sizeInMb = size / (1024 * 1024);
    if (sizeInMb >= 1) {
        return `${sizeInMb.toFixed(1)} MB`;
    }

    return `${Math.max(1, Math.round(size / 1024))} KB`;
};

const getAvatarColor = (sector?: string) => {
    const colors: Record<string, string> = {
        Nord: 'from-blue-500 to-cyan-500',
        Sud: 'from-orange-500 to-red-500',
        Est: 'from-green-500 to-emerald-500',
        Ouest: 'from-purple-500 to-pink-500',
    };

    return (sector ? colors[sector] : undefined) || 'from-slate-500 to-slate-600';
};

const getInitials = (name?: string) => {
    if (!name) return 'AA';
    return name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

const getSeverityColor = (health: string): HealthColor => {
    if (health === 'Critical') return { text: '#EF4444', bg: '#EF44440A', border: '#EF44441A' };
    if (health === 'Warning') return { text: '#F59E0B', bg: '#F59E0B0A', border: '#F59E0B1A' };
    return { text: '#1D9E75', bg: '#1D9E750A', border: '#1D9E751A' };
};

const useDebouncedCallback = <T extends (...args: any[]) => void | Promise<void>>(callback: T, delay: number) => {
    const callbackRef = useRef(callback);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return useCallback((...args: Parameters<T>) => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = window.setTimeout(() => {
            void callbackRef.current(...args);
        }, delay);
    }, [delay]);
};

const createDefaultHistoryForm = (): HistoryFormState => ({
    date: new Date().toISOString().slice(0, 10),
    type: 'vaccine',
    notes: '',
    vetName: '',
});

const AnimalProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const devices = useIoTStore((state) => state.devices);

    const animals = useMemo(() => Object.values(devices), [devices]);

    const animal = useMemo(() => {
        return (id ? devices[id] : undefined) || animals.find((a) => a.sheepId === id || a.collar_id === id);
    }, [animals, devices, id]);

    const animalId = useMemo(() => String(id || animal?.sheepId || animal?.collar_id || ''), [animal?.collar_id, animal?.sheepId, id]);

    const animalIndex = useMemo(() => animals.findIndex((a) => a.sheepId === id || a.collar_id === id), [animals, id]);

    const [activeTab, setActiveTab] = useState<ProfileTab>('vitals');
    const [historyForm, setHistoryForm] = useState<HistoryFormState>(createDefaultHistoryForm);
    const [notesDraft, setNotesDraft] = useState((animal as any)?.notes ?? '');
    const [notesSaveState, setNotesSaveState] = useState<NotesSaveState>('idle');
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [documentError, setDocumentError] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const notesSaveTokenRef = useRef(0);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const reportRange = useMemo(() => {
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 30);

        return {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        };
    }, []);

    const medicalHistoryKey = ['animal-medical-history', animalId] as const;
    const documentsKey = ['animal-documents', animalId] as const;

    const medicalHistoryQuery = useQuery({
        queryKey: medicalHistoryKey,
        queryFn: () => fetchMedicalHistory(animalId),
        enabled: Boolean(animalId),
    });

    const documentsQuery = useQuery({
        queryKey: documentsKey,
        queryFn: () => fetchAnimalDocuments(animalId),
        enabled: Boolean(animalId),
    });

    useEffect(() => {
        if (!animalId) {
            return;
        }

        setNotesDraft((animal as any)?.notes ?? '');
        setNotesSaveState('idle');
        setLastSavedAt((animal as any)?.notesUpdatedAt ? new Date((animal as any).notesUpdatedAt) : null);
        setHistoryForm(createDefaultHistoryForm());
        setDocumentError(null);
    }, [animalId]);

    const handlePrevAnimal = useCallback(() => {
        if (animalIndex > 0) {
            const prevId = animals[animalIndex - 1].collar_id || animals[animalIndex - 1].sheepId;
            navigate(`/animals/${prevId}`);
        }
    }, [animalIndex, animals, navigate]);

    const handleNextAnimal = useCallback(() => {
        if (animalIndex < animals.length - 1) {
            const nextId = animals[animalIndex + 1].collar_id || animals[animalIndex + 1].sheepId;
            navigate(`/animals/${nextId}`);
        }
    }, [animalIndex, animals, navigate]);

    const handlePlanVisit = useCallback(() => {
        if (!animalId) return;
        navigate(`/agenda?prefill=${encodeURIComponent(animalId)}&open=create`);
    }, [animalId, navigate]);

    const handleDownloadReport = useCallback(async () => {
        if (!animalId) return;

        try {
            await downloadPDFReport('veterinary', {
                sheepId: animalId,
                startDate: reportRange.startDate,
                endDate: reportRange.endDate,
            });
            toast.success('Rapport PDF téléchargé.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Impossible de générer le rapport PDF.');
        }
    }, [animalId, reportRange.endDate, reportRange.startDate]);

    const archiveMutation = useMutation({
        mutationFn: () => animalsService.archive(animalId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['animals'] });
            toast.success('Animal archivé.');
            navigate('/animals', { replace: true });
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Impossible d’archiver l’animal.');
        },
    });

    const handleArchiveAnimal = useCallback(() => {
        if (!animalId || archiveMutation.isPending) return;

        const confirmed = window.confirm(`Archiver ${animal?.name ?? 'cet animal'} ?`);
        if (!confirmed) return;

        archiveMutation.mutate();
    }, [animal?.name, animalId, archiveMutation]);

    const handleHistoryReset = useCallback(() => {
        setHistoryForm(createDefaultHistoryForm());
    }, []);

    const saveHistoryMutation = useMutation({
        mutationFn: (input: MedicalHistoryInput) => createMedicalHistoryRecord(animalId, input),
        onMutate: async (input) => {
            await queryClient.cancelQueries({ queryKey: medicalHistoryKey });

            const previousHistory = queryClient.getQueryData<MedicalHistoryRecord[]>(medicalHistoryKey) ?? [];
            const tempRecord: MedicalHistoryRecord = {
                id: `temp-${Date.now()}`,
                date: input.date,
                type: input.type,
                notes: input.notes.trim(),
                vetName: input.vetName.trim(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData<MedicalHistoryRecord[]>(medicalHistoryKey, [tempRecord, ...previousHistory]);
            return { previousHistory, tempRecordId: tempRecord.id };
        },
        onError: (error, _input, context) => {
            if (context?.previousHistory) {
                queryClient.setQueryData(medicalHistoryKey, context.previousHistory);
            }

            toast.error(error instanceof Error ? error.message : 'Impossible d’ajouter l’entrée médicale.');
        },
        onSuccess: (savedRecord, _input, context) => {
            queryClient.setQueryData<MedicalHistoryRecord[]>(medicalHistoryKey, (current = []) =>
                current.map((record) => (record.id === context?.tempRecordId ? savedRecord : record))
            );
            setHistoryForm(createDefaultHistoryForm());
            toast.success('Entrée médicale ajoutée.');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: medicalHistoryKey });
        },
    });

    const uploadMutation = useMutation({
        mutationFn: (file: File) => uploadAnimalDocument(animalId, file),
        onMutate: async (file) => {
            await queryClient.cancelQueries({ queryKey: documentsKey });

            const previousDocuments = queryClient.getQueryData<AnimalDocumentRecord[]>(documentsKey) ?? [];
            const previewUrl = window.URL.createObjectURL(file);
            const tempRecord: AnimalDocumentRecord = {
                id: `temp-${Date.now()}`,
                name: file.name,
                date: new Date().toISOString(),
                type: getDocumentTypeFromFile(file),
                size: file.size,
                url: previewUrl,
                mimeType: file.type || undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData<AnimalDocumentRecord[]>(documentsKey, [tempRecord, ...previousDocuments]);
            return { previousDocuments, tempRecordId: tempRecord.id, previewUrl };
        },
        onError: (error, _file, context) => {
            if (context?.previewUrl) {
                window.URL.revokeObjectURL(context.previewUrl);
            }

            if (context?.previousDocuments) {
                queryClient.setQueryData(documentsKey, context.previousDocuments);
            }

            toast.error(error instanceof Error ? error.message : 'Impossible d’uploader le document.');
        },
        onSuccess: (savedDocument, _file, context) => {
            const nextDocument = {
                ...savedDocument,
                url: savedDocument.url || context?.previewUrl,
            };

            if (context?.previewUrl && nextDocument.url !== context.previewUrl) {
                window.URL.revokeObjectURL(context.previewUrl);
            }

            queryClient.setQueryData<AnimalDocumentRecord[]>(documentsKey, (current = []) =>
                current.map((record) => (record.id === context?.tempRecordId ? nextDocument : record))
            );

            toast.success('Document uploadé.');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: documentsKey });
        },
    });

    const deleteDocumentMutation = useMutation({
        mutationFn: (documentId: string) => deleteAnimalDocument(animalId, documentId),
        onMutate: async (documentId) => {
            await queryClient.cancelQueries({ queryKey: documentsKey });

            const previousDocuments = queryClient.getQueryData<AnimalDocumentRecord[]>(documentsKey) ?? [];
            const deletedDocument = previousDocuments.find((document) => document.id === documentId);
            queryClient.setQueryData<AnimalDocumentRecord[]>(documentsKey, previousDocuments.filter((document) => document.id !== documentId));
            return { previousDocuments, deletedDocument };
        },
        onError: (error, _documentId, context) => {
            if (context?.previousDocuments) {
                queryClient.setQueryData(documentsKey, context.previousDocuments);
            }

            toast.error(error instanceof Error ? error.message : 'Impossible de supprimer le document.');
        },
        onSuccess: (_response, _documentId, context) => {
            if (context?.deletedDocument?.url?.startsWith('blob:')) {
                window.URL.revokeObjectURL(context.deletedDocument.url);
            }

            toast.success('Document supprimé.');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: documentsKey });
        },
    });

    const saveNotes = useCallback(async (content: string) => {
        const saveToken = ++notesSaveTokenRef.current;
        setNotesSaveState('saving');

        try {
            const response = await patchAnimalNotes(animalId, content);
            if (saveToken !== notesSaveTokenRef.current) {
                return;
            }

            setLastSavedAt(new Date(response.updatedAt));
            setNotesSaveState('saved');
        } catch (error) {
            if (saveToken !== notesSaveTokenRef.current) {
                return;
            }

            setNotesSaveState('error');
            toast.error(error instanceof Error ? error.message : 'Impossible de sauvegarder les notes.');
        }
    }, [animalId]);

    const debouncedSave = useDebouncedCallback(async (content: string) => {
        await saveNotes(content);
    }, 1500);

    const handleNotesChange = useCallback((content: string) => {
        setNotesDraft(content);
        setNotesSaveState('saving');
        debouncedSave(content);
    }, [debouncedSave]);

    const handleFiles = useCallback((files: File[]) => {
        if (!files.length) {
            return;
        }

        setDocumentError(null);

        files.forEach((file) => {
            const lowerName = file.name.toLowerCase();
            const isAllowedType = allowedDocumentMimeTypes.includes(file.type as typeof allowedDocumentMimeTypes[number])
                || allowedDocumentExtensions.some((extension) => lowerName.endsWith(extension));

            if (!isAllowedType) {
                setDocumentError('Formats autorisés: PDF, JPG et PNG.');
                toast.error('Formats autorisés: PDF, JPG et PNG.');
                return;
            }

            if (file.size > maxDocumentSizeBytes) {
                setDocumentError('Taille maximale: 5 MB.');
                toast.error('Le fichier dépasse la taille limite de 5 MB.');
                return;
            }

            uploadMutation.mutate(file);
        });
    }, [uploadMutation]);

    const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        handleFiles(files);
        event.target.value = '';
    }, [handleFiles]);

    const handleDocumentDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragActive(false);
        handleFiles(Array.from(event.dataTransfer.files ?? []));
    }, [handleFiles]);

    const handleDocumentDrag = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setDragActive(event.type === 'dragenter' || event.type === 'dragover');
    }, []);

    const medicalHistory = medicalHistoryQuery.data ?? [];
    const documents = documentsQuery.data ?? [];
    const filteredHistory = useMemo(() => medicalHistory.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [medicalHistory]);

    const severityColor = useMemo(() => getSeverityColor(animal?.health || 'Good'), [animal?.health]);

    const notesStatusLabel = useMemo(() => {
        if (notesSaveState === 'saving') return 'Sauvegarde en cours...';
        if (notesSaveState === 'saved' && lastSavedAt) return `Sauvegardé à ${formatTime(lastSavedAt)}`;
        if (notesSaveState === 'error') return 'Erreur de sauvegarde';
        if (lastSavedAt) return `Sauvegardé à ${formatTime(lastSavedAt)}`;
        return 'Aucune sauvegarde enregistrée';
    }, [lastSavedAt, notesSaveState]);

    const renderVitalsTab = () => (
        <motion.div
            key="vitals"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {VITALS.map((vital) => (
                    <VitalBox
                        key={vital.label}
                        label={vital.label}
                        value={(animal as any)?.[vital.key] ?? vital.min + 10}
                        unit={vital.unit}
                        range={{ min: vital.min, max: vital.max }}
                        icon={vital.icon}
                    />
                ))}
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Évolution 7 jours</h3>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="text-primary">7j</Button>
                        <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-400">30j</Button>
                    </div>
                </div>
                <div className="h-64 bg-gray-50 dark:bg-gray-900/50 rounded-xl flex items-center justify-center border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Graphique Chart.js - Température & BPM</p>
                </div>
            </div>
        </motion.div>
    );

    const renderHistoryTab = () => (
        <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
        >
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Ajouter un enregistrement</p>
                        <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">Historique médical</h3>
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleHistoryReset}>
                        Réinitialiser
                    </Button>
                </div>

                <form
                    className="grid gap-4 md:grid-cols-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!historyForm.notes.trim() || !historyForm.vetName.trim()) {
                            toast.error('Veuillez remplir les notes et le nom du vétérinaire.');
                            return;
                        }

                        saveHistoryMutation.mutate({
                            ...historyForm,
                            notes: historyForm.notes.trim(),
                            vetName: historyForm.vetName.trim(),
                        });
                    }}
                >
                    <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.15em] text-gray-400">Date</label>
                        <input
                            type="date"
                            value={historyForm.date}
                            onChange={(event) => setHistoryForm((current) => ({ ...current, date: event.target.value }))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.15em] text-gray-400">Type</label>
                        <select
                            value={historyForm.type}
                            onChange={(event) => setHistoryForm((current) => ({ ...current, type: event.target.value as MedicalHistoryType }))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        >
                            {HISTORY_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.15em] text-gray-400">Notes</label>
                        <textarea
                            value={historyForm.notes}
                            onChange={(event) => setHistoryForm((current) => ({ ...current, notes: event.target.value }))}
                            rows={4}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            placeholder="Décrivez l’événement médical"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.15em] text-gray-400">Vétérinaire</label>
                        <input
                            value={historyForm.vetName}
                            onChange={(event) => setHistoryForm((current) => ({ ...current, vetName: event.target.value }))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            placeholder="Dr. Martin"
                        />
                    </div>

                    <div className="flex items-end justify-end md:col-span-2">
                        <Button type="submit" variant="primary" disabled={saveHistoryMutation.isPending}>
                            {saveHistoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Ajouter le record
                        </Button>
                    </div>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Chronologie</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Les événements les plus récents apparaissent en premier.</p>
                    </div>
                </div>

                {medicalHistoryQuery.isLoading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="animate-pulse rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                                <div className="h-4 w-32 rounded bg-gray-100 dark:bg-gray-800" />
                                <div className="mt-3 h-3 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
                                <div className="mt-2 h-3 w-1/2 rounded bg-gray-50 dark:bg-gray-900/60" />
                            </div>
                        ))}
                    </div>
                ) : medicalHistoryQuery.isError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
                        <p className="font-semibold">Impossible de charger l’historique.</p>
                        <p className="mt-1 text-sm">{medicalHistoryQuery.error instanceof Error ? medicalHistoryQuery.error.message : 'Erreur inconnue.'}</p>
                    </div>
                ) : filteredHistory.length === 0 ? (
                    <EmptyHistory onReset={handleHistoryReset} />
                ) : (
                    <div className="space-y-0">
                        {filteredHistory.map((event, index) => {
                            const badge = MEDICAL_HISTORY_BADGES[event.type];
                            return (
                                <div key={event.id} className="relative flex gap-4 pb-8 last:pb-0">
                                    {index < filteredHistory.length - 1 && <div className="absolute left-5 top-11 h-10 w-0.5 bg-gray-200 dark:bg-gray-700" />}
                                    <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border ${badge.className}`}>
                                        <span>{badge.icon}</span>
                                    </div>
                                    <div className="flex-1 rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-gray-900 dark:text-white">{badge.label}</h4>
                                                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${badge.className}`}>{badge.label}</span>
                                                </div>
                                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{event.notes}</p>
                                            </div>
                                            <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                                                <p>{formatDate(event.date)}</p>
                                                <p className="mt-1">{event.vetName}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </motion.div>
    );

    const renderDocumentsTab = () => (
        <motion.div
            key="documents"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
        >
            <div
                className={`rounded-2xl border-2 border-dashed p-8 transition-all ${dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50'
                    }`}
                onDragEnter={handleDocumentDrag}
                onDragOver={handleDocumentDrag}
                onDragLeave={handleDocumentDrag}
                onDrop={handleDocumentDrop}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={allowedDocumentExtensions.join(',')}
                    className="hidden"
                    onChange={handleFileInputChange}
                />

                <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                        <Upload className="h-7 w-7" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Uploader un document</h3>
                    <p className="mt-2 max-w-lg text-sm text-gray-500 dark:text-gray-400">
                        Déposez un PDF, JPG ou PNG. Taille maximale autorisée: 5 MB.
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                        <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
                            Sélectionner un fichier
                        </Button>
                    </div>
                    {documentError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{documentError}</p>}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Documents</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Liste des pièces jointes du dossier.</p>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{documents.length} fichier{documents.length > 1 ? 's' : ''}</span>
                </div>

                {documentsQuery.isLoading ? (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {Array.from({ length: 2 }).map((_, index) => (
                            <div key={index} className="animate-pulse p-6 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-gray-800" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 w-48 rounded bg-gray-100 dark:bg-gray-800" />
                                        <div className="h-3 w-32 rounded bg-gray-50 dark:bg-gray-900/60" />
                                    </div>
                                </div>
                                <div className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-gray-800" />
                            </div>
                        ))}
                    </div>
                ) : documentsQuery.isError ? (
                    <div className="p-6">
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
                            <p className="font-semibold">Impossible de charger les documents.</p>
                            <p className="mt-1 text-sm">{documentsQuery.error instanceof Error ? documentsQuery.error.message : 'Erreur inconnue.'}</p>
                        </div>
                    </div>
                ) : documents.length === 0 ? (
                    <div className="p-6">
                        <EmptyDocuments onUpload={() => fileInputRef.current?.click()} />
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {documents.map((document) => {
                            const badge = DOCUMENT_BADGES[document.type.toLowerCase()] || { label: document.type.toUpperCase(), className: 'bg-gray-50 text-gray-700 border-gray-100 dark:bg-gray-500/10 dark:text-gray-300 dark:border-gray-500/20' };
                            return (
                                <div key={document.id} className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                                    <div className="flex items-start gap-4 min-w-0 flex-1">
                                        <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                                            <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-gray-900 dark:text-white truncate">{document.name}</p>
                                                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${badge.className}`}>{badge.label}</span>
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                {formatDate(document.date)} • {formatDocumentSize(document.size)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 md:justify-end">
                                        <a
                                            href={document.url || '#'}
                                            download={document.name}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-transparent px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                                        >
                                            <Download className="h-4 w-4" />
                                            Télécharger
                                        </a>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="px-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                            onClick={() => deleteDocumentMutation.mutate(document.id)}
                                            disabled={deleteDocumentMutation.isPending}
                                        >
                                            {deleteDocumentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            Supprimer
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </motion.div>
    );

    const renderNotesTab = () => (
        <motion.div
            key="notes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
        >
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notes cliniques</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Les modifications sont sauvegardées automatiquement après 1,5 seconde.</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {notesSaveState === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        <span>{notesStatusLabel}</span>
                    </div>
                </div>

                <textarea
                    value={notesDraft}
                    onChange={(event) => handleNotesChange(event.target.value)}
                    className="w-full min-h-[280px] rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="Saisissez les observations cliniques..."
                />

                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="h-4 w-4" />
                    <span>{notesSaveState === 'saving' ? 'Sauvegarde en cours...' : notesStatusLabel}</span>
                </div>
            </div>
        </motion.div>
    );

    if (!animal) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto" />
                    <p className="text-gray-600 dark:text-gray-300">Animal non trouvé</p>
                    <Button variant="primary" onClick={() => navigate('/animals')} className="px-6 py-2">Retour à la liste</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/animals')} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <ArrowLeft className="w-5 h-5" /> Retour
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handlePrevAnimal} disabled={animalIndex <= 0} className="p-2" title="Animal précédent">
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <span className="text-xs text-gray-500 px-2 min-w-fit">{animalIndex + 1} / {animals.length}</span>
                        <Button variant="ghost" size="sm" onClick={handleNextAnimal} disabled={animalIndex >= animals.length - 1} className="p-2" title="Animal suivant">
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" className="text-blue-600 dark:text-blue-400" onClick={handlePlanVisit}>
                            📅 Planifier visite
                        </Button>
                        <Button variant="secondary" size="sm" className="text-green-600 dark:text-green-400" onClick={handleDownloadReport}>
                            📊 Rapport
                        </Button>
                        <div className="relative group">
                            <Button variant="ghost" size="sm" className="p-2 text-gray-600 dark:text-gray-300">
                                <MoreVertical className="w-5 h-5" />
                            </Button>
                            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg hidden group-hover:block py-1 z-50">
                                <Button variant="ghost" size="sm" onClick={handleArchiveAnimal} className="w-full px-4 py-2 justify-start text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
                                    <Archive className="w-4 h-4" />
                                    Archiver l'animal
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <div className="flex gap-6 items-start">
                        <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${getAvatarColor(animal.sector)} flex items-center justify-center text-white text-2xl font-bold shadow-lg flex-shrink-0`}>
                            {getInitials(animal.name)}
                        </div>

                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{animal.name}</h1>
                                <span className="text-gray-500 dark:text-gray-400 font-semibold">#{animal.sheepId}</span>
                            </div>
                            <div className="flex flex-wrap gap-3 items-center mb-4">
                                <span className="text-sm text-gray-600 dark:text-gray-300">{animal.breed}</span>
                                <span className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    {animal.age} ans
                                </span>
                                <span className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    {animal.weight ?? '--'} kg
                                </span>
                                {animal.sector && (
                                    <span className="px-2 py-1 rounded-full text-xs bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
                                        <MapPin className="inline h-3.5 w-3.5 mr-1" />
                                        {animal.sector}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <div
                                    className="px-3 py-1 rounded-full border text-sm font-semibold flex items-center gap-2"
                                    style={{
                                        color: severityColor.text,
                                        backgroundColor: severityColor.bg,
                                        borderColor: severityColor.border,
                                    }}
                                >
                                    {animal.health === 'Critical' ? (
                                        <AlertCircle className="w-4 h-4" />
                                    ) : animal.health === 'Warning' ? (
                                        <Zap className="w-4 h-4" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4" />
                                    )}
                                    {animal.health || 'Normal'}
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Mis à jour {new Date(animal.lastUpdate || Date.now()).toLocaleTimeString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-16 z-30">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-8">
                        {(Object.keys(TAB_META) as ProfileTab[]).map((tab) => (
                            <Button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                variant="ghost"
                                size="sm"
                                className={`py-4 px-2 border-b-2 font-semibold text-sm transition-colors rounded-none ${activeTab === tab
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    {TAB_META[tab].icon}
                                    {TAB_META[tab].label}
                                </span>
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <AnimatePresence mode="wait">
                    {activeTab === 'vitals' && (
                        <TabErrorBoundary fallback={<TabCrashFallback title="Les vitaux ont rencontré une erreur" />}>
                            {renderVitalsTab()}
                        </TabErrorBoundary>
                    )}

                    {activeTab === 'history' && (
                        <TabErrorBoundary fallback={<TabCrashFallback title="L’historique médical a rencontré une erreur" />}>
                            {renderHistoryTab()}
                        </TabErrorBoundary>
                    )}

                    {activeTab === 'documents' && (
                        <TabErrorBoundary fallback={<TabCrashFallback title="Les documents ont rencontré une erreur" />}>
                            {renderDocumentsTab()}
                        </TabErrorBoundary>
                    )}

                    {activeTab === 'notes' && (
                        <TabErrorBoundary fallback={<TabCrashFallback title="Les notes ont rencontré une erreur" />}>
                            {renderNotesTab()}
                        </TabErrorBoundary>
                    )}
                </AnimatePresence>
            </div>

            <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Position GPS - 24h</h3>
                    <MiniGPSMap animalId={(animal.sheepId || animal.collar_id) as string} />
                </div>
            </div>
        </div>
    );
};

export default AnimalProfile;
