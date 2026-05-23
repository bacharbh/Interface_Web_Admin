import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight,
    BellRing,
    FileDown,
    UserPlus,
    Stethoscope,
    ShieldAlert,
    X,
    CheckCircle2,
    ChevronDown,
} from 'lucide-react';

export interface NewAnimalForm {
    species: string;
    collarId: string;
    name?: string;
}

export interface QuickActionsPanelProps {
    confinementActive: boolean;
    lastExportTime: Date | null;
    lastCallTime: Date | null;
    onAddAnimal: (data: NewAnimalForm) => void;
    onToggleConfinement: (active: boolean) => void;
    onExportReport: (format: 'pdf' | 'csv') => void;
    onCallVet: () => void;
}

type ExportFormat = 'pdf' | 'csv';

const speciesOptions = [
    { value: 'sheep', label: 'Ovin' },
    { value: 'goat', label: 'Caprin' },
    { value: 'cow', label: 'Bovin' },
    { value: 'camel', label: 'Camelin' },
    { value: 'horse', label: 'Équin' },
];

function formatRelativeTime(date: Date | null): string {
    if (!date) return 'Jamais exécuté';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 1) return 'Il y a quelques secondes';
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    return `Il y a ${diffDays} j`;
}

function getTodayLabel(date: Date | null): string {
    if (!date) return 'Aucune action récente';
    return new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    }).format(date);
}

function focusableElements(container: HTMLElement | null): HTMLElement[] {
    if (!container) return [];
    return Array.from(
        container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
    ).filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));
}

function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement>, onClose?: () => void) {
    useEffect(() => {
        if (!active) return;

        const previousFocus = document.activeElement as HTMLElement | null;
        const container = containerRef.current;
        const focusables = focusableElements(container);

        focusables[0]?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose?.();
                return;
            }

            if (event.key !== 'Tab') return;

            const currentFocusables = focusableElements(containerRef.current);
            if (currentFocusables.length === 0) {
                event.preventDefault();
                return;
            }

            const first = currentFocusables[0];
            const last = currentFocusables[currentFocusables.length - 1];
            const activeElement = document.activeElement as HTMLElement | null;

            if (event.shiftKey && activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previousFocus?.focus?.();
        };
    }, [active, containerRef, onClose]);
}

const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
    confinementActive,
    lastExportTime,
    lastCallTime,
    onAddAnimal,
    onToggleConfinement,
    onExportReport,
    onCallVet,
}) => {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isConfinementPending, setIsConfinementPending] = useState(false);
    const [species, setSpecies] = useState(speciesOptions[0].value);
    const [collarId, setCollarId] = useState('');
    const [name, setName] = useState('');
    const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
    const [exportSucceeded, setExportSucceeded] = useState(false);

    const addModalRef = useRef<HTMLDivElement | null>(null);
    const confirmModalRef = useRef<HTMLDivElement | null>(null);

    useFocusTrap(isAddOpen, addModalRef, () => setIsAddOpen(false));
    useFocusTrap(isConfinementPending, confirmModalRef, () => setIsConfinementPending(false));

    useEffect(() => {
        if (!exportSucceeded) return;
        const timer = window.setTimeout(() => setExportSucceeded(false), 3000);
        return () => window.clearTimeout(timer);
    }, [exportSucceeded]);

    const confinementLabel = confinementActive ? '⚠️ Confinement actif' : 'Confinement désactivé';

    const addAnimalSummary = useMemo(() => {
        return `${speciesOptions.find((option) => option.value === species)?.label ?? 'Animal'} · Collier ${collarId || '—'}`;
    }, [collarId, species]);

    const handleSubmitAnimal = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onAddAnimal({ species, collarId: collarId.trim(), name: name.trim() || undefined });
        setIsAddOpen(false);
        setSpecies(speciesOptions[0].value);
        setCollarId('');
        setName('');
    };

    const handleExport = () => {
        onExportReport(exportFormat);
        setExportSucceeded(true);
    };

    const handleVetCall = () => {
        onCallVet();
    };

    const exportStatusText = exportSucceeded ? '✓ Rapport généré' : `Dernier export : ${getTodayLabel(lastExportTime)}`;
    const vetStatusText = `Dernier appel : ${formatRelativeTime(lastCallTime)}`;

    return (
        <section className="w-full rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-card-dark shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Actions rapides</p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">Opérations terrain</h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-300">
                    <BellRing className="h-3.5 w-3.5" />
                    Temps réel
                </span>
            </div>

            <div className="p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <button
                        type="button"
                        onClick={() => setIsAddOpen(true)}
                        className="group w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:shadow-lg hover:shadow-emerald-500/10 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-transform duration-200 group-hover:scale-105 dark:bg-emerald-500/10 dark:text-emerald-300">
                                <UserPlus className="h-5 w-5" />
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500" />
                        </div>
                        <div className="mt-4 space-y-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Ajouter un animal</p>
                            <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">Créer une nouvelle fiche animal</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        role="switch"
                        aria-checked={confinementActive}
                        aria-label="Mode confinement"
                        onClick={() => {
                            if (!confinementActive) {
                                setIsConfinementPending(true);
                                return;
                            }
                            onToggleConfinement(false);
                        }}
                        className={`group w-full rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg dark:bg-slate-900/40 dark:hover:bg-slate-900 ${confinementActive
                            ? 'border-red-300 bg-red-50/60 hover:shadow-red-500/10 animate-[pulse_2s_ease-in-out_infinite] dark:border-red-500/40 dark:bg-red-500/5'
                            : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:shadow-slate-500/10 dark:border-slate-800'
                            }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105 ${confinementActive
                                ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                                : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                <ShieldAlert className="h-5 w-5" />
                            </div>
                            <span
                                aria-hidden="true"
                                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${confinementActive
                                    ? 'border-red-400 bg-red-500'
                                    : 'border-slate-300 bg-slate-200 dark:border-slate-700 dark:bg-slate-800'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${confinementActive ? 'translate-x-6' : 'translate-x-1'}`}
                                />
                            </span>
                        </div>
                        <div className="mt-4 space-y-1">
                            <p className={`text-sm font-semibold ${confinementActive ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>
                                {confinementLabel}
                            </p>
                            <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                                {confinementActive ? 'Surveillance renforcée en cours' : 'Intervention manuelle requise pour activer'}
                            </p>
                        </div>
                    </button>

                    <div className={`group rounded-2xl border bg-slate-50/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg dark:bg-slate-900/40 dark:hover:bg-slate-900 ${exportSucceeded
                        ? 'border-emerald-300 shadow-lg shadow-emerald-500/10 dark:border-emerald-500/30'
                        : 'border-slate-200 hover:border-amber-300 hover:shadow-amber-500/10 dark:border-slate-800'
                        }`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 transition-transform duration-200 group-hover:scale-105 dark:bg-amber-500/10 dark:text-amber-300">
                                <FileDown className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-500 shadow-sm dark:bg-slate-950/60 dark:text-slate-300">
                                <CheckCircle2 className={`h-3.5 w-3.5 ${exportSucceeded ? 'text-emerald-500' : 'text-slate-300'}`} />
                                {exportSucceeded ? 'Succès' : 'Rapport'}
                            </div>
                        </div>
                        <div className="mt-4 space-y-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Exporter rapport</p>
                            <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">{exportStatusText}</p>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <label className="relative inline-flex flex-1 items-center">
                                <select
                                    aria-label="Format du rapport"
                                    value={exportFormat}
                                    onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                >
                                    <option value="pdf">PDF</option>
                                    <option value="csv">CSV</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400" />
                            </label>
                            <button
                                type="button"
                                onClick={handleExport}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Exporter
                            </button>
                        </div>
                    </div>

                    <div className="group rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white hover:shadow-lg hover:shadow-blue-500/10 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-transform duration-200 group-hover:scale-105 dark:bg-blue-500/10 dark:text-blue-300">
                                <Stethoscope className="h-5 w-5" />
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500" />
                        </div>
                        <div className="mt-4 space-y-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Appel vétérinaire</p>
                            <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">{vetStatusText}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleVetCall}
                            aria-label="Appeler le vétérinaire"
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                        >
                            Appeler
                        </button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isAddOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="quick-actions-add-title"
                        onClick={() => setIsAddOpen(false)}
                    >
                        <motion.div
                            ref={addModalRef}
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                            className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-card-dark shadow-2xl border-l border-slate-200 dark:border-slate-800"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex h-full flex-col">
                                <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 p-5 sm:p-6">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Nouvel animal</p>
                                        <h4 id="quick-actions-add-title" className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Ajouter un animal</h4>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Création rapide pour le suivi terrain.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddOpen(false)}
                                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                        aria-label="Fermer le formulaire d'ajout"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmitAnimal} className="flex flex-1 flex-col justify-between p-5 sm:p-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="quick-actions-species" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Espèce</label>
                                            <select
                                                id="quick-actions-species"
                                                required
                                                value={species}
                                                onChange={(event) => setSpecies(event.target.value)}
                                                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            >
                                                {speciesOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label htmlFor="quick-actions-collar" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">ID collier</label>
                                            <input
                                                id="quick-actions-collar"
                                                required
                                                value={collarId}
                                                onChange={(event) => setCollarId(event.target.value)}
                                                placeholder="EX: C-2048"
                                                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="quick-actions-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Nom <span className="font-medium normal-case tracking-normal">(optionnel)</span></label>
                                            <input
                                                id="quick-actions-name"
                                                value={name}
                                                onChange={(event) => setName(event.target.value)}
                                                placeholder="Ex: Violette"
                                                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 text-sm text-slate-600 dark:text-slate-300">
                                            <p className="font-semibold text-slate-900 dark:text-white">Aperçu</p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{addAnimalSummary}</p>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsAddOpen(false)}
                                            className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5"
                                        >
                                            Ajouter l’animal
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isConfinementPending && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="quick-actions-confirm-title"
                        onClick={() => setIsConfinementPending(false)}
                    >
                        <motion.div
                            ref={confirmModalRef}
                            initial={{ scale: 0.96, y: 8 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.96, y: 8 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                            className="w-full max-w-sm rounded-3xl border border-red-200 bg-white p-5 shadow-2xl dark:border-red-500/30 dark:bg-card-dark"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                                    <ShieldAlert className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <h4 id="quick-actions-confirm-title" className="text-base font-semibold text-slate-900 dark:text-white">Activer le mode confinement ?</h4>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Cette action signalera une restriction active sur le troupeau et déclenchera les alertes associées.</p>
                                </div>
                            </div>

                            <div className="mt-5 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsConfinementPending(false)}
                                    className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onToggleConfinement(true);
                                        setIsConfinementPending(false);
                                    }}
                                    className="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-transform hover:-translate-y-0.5"
                                >
                                    Activer
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </section>
    );
};

export default QuickActionsPanel;