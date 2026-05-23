import React, { useMemo, useState } from 'react';
import {
    Battery, Bell, Clock3, Mail, MessageSquare, RotateCcw,
    ShieldAlert, Thermometer, ToggleLeft, ToggleRight, WifiOff,
    AlertTriangle, Activity, Siren
} from 'lucide-react';
import { useIoTStore } from '../../hooks/useIoTStore';

const POLLING_MIN = 1;
const POLLING_MAX = 60;

type AnomalyKey = keyof typeof ANOMALY_LABELS;

const ANOMALY_LABELS = {
    batteryCritical: 'Batterie critique',
    temperatureCritical: 'Température critique',
    immobility: 'Immobilité',
    outOfZone: 'Sortie de zone',
    signalLoss: 'Perte de signal',
} as const;

function Section({
    icon,
    title,
    subtitle,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-3xl border border-white/10 bg-white/80 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 md:p-8">
            <div className="mb-6 flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    {icon}
                </div>
                <div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">{title}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
                </div>
            </div>
            {children}
        </section>
    );
}

function ToggleRow({
    label,
    description,
    checked,
    onChange,
    disabled,
    icon,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    icon: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!checked)}
            className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition ${checked
                ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/5'
                } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 text-slate-500 dark:text-slate-400">{icon}</div>
                <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                </div>
            </div>
            <div className="shrink-0 text-emerald-500 dark:text-emerald-400">
                {checked ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7" />}
            </div>
        </button>
    );
}

function NumberField({
    label,
    value,
    min,
    max,
    step,
    suffix,
    onChange,
    helper,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    suffix: string;
    onChange: (value: number) => void;
    helper: string;
}) {
    return (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</p>
                </div>
                <div className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-black tabular-nums text-slate-900 dark:bg-slate-800 dark:text-white">
                    {value}{suffix}
                </div>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-500 dark:bg-slate-800"
            />
            <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                <span>{min}{suffix}</span>
                <span>{max}{suffix}</span>
            </div>
        </div>
    );
}

export default function AISettings() {
    const aiSettings = useIoTStore((state) => state.aiSettings);
    const setAISettings = useIoTStore((state) => state.setAISettings);
    const resetAISettings = useIoTStore((state) => state.resetAISettings);
    const [flash, setFlash] = useState(false);

    const enabledRules = useMemo(() => {
        return Object.values(aiSettings.anomalyRules).filter(Boolean).length;
    }, [aiSettings.anomalyRules]);

    const handleFlash = () => {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 1400);
    };

    const updateThreshold = (key: 'batteryCritical' | 'temperatureCritical' | 'immobilityMinutes', value: number) => {
        setAISettings({ alertThresholds: { [key]: value } as any });
        handleFlash();
    };

    const updatePolling = (value: number) => {
        setAISettings({ pollingIntervalMinutes: value });
        handleFlash();
    };

    const updateChannel = (key: 'toast' | 'email' | 'sms', value: boolean) => {
        if (key !== 'toast' && !value && !aiSettings.notificationChannels.toast) {
            return;
        }
        setAISettings({ notificationChannels: { [key]: key === 'toast' ? true : value } as any });
        handleFlash();
    };

    const updateRule = (key: AnomalyKey, value: boolean) => {
        setAISettings({ anomalyRules: { [key]: value } as any });
        handleFlash();
    };

    const handleReset = () => {
        resetAISettings();
        handleFlash();
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-6 md:px-6 animate-fade-in">
            <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-2xl shadow-slate-950/20 md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-200">
                            <Siren className="h-3.5 w-3.5" /> AI settings
                        </div>
                        <h1 className="text-3xl font-black tracking-tight md:text-5xl">Paramètres IA</h1>
                        <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
                            Ajustez les seuils d’alerte, la cadence de polling et les canaux de notification pour piloter les règles IA.
                            Les changements sont sauvegardés automatiquement dans le store Zustand et dans le navigateur.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[420px]">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Règles actives</p>
                            <p className="mt-2 text-2xl font-black">{enabledRules}/{Object.keys(aiSettings.anomalyRules).length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Polling</p>
                            <p className="mt-2 text-2xl font-black">{aiSettings.pollingIntervalMinutes}m</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Notifications</p>
                            <p className="mt-2 text-2xl font-black">{Object.entries(aiSettings.notificationChannels).filter(([, value]) => value).length}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Persistance</p>
                            <p className="mt-2 text-2xl font-black">Auto</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6">
                    <Section
                        icon={<ShieldAlert className="h-6 w-6" />}
                        title="Seuils d’alerte par métrique"
                        subtitle="Définissez les limites qui déclenchent les alertes critiques ou les signaux d’attention."
                    >
                        <div className="grid gap-4">
                            <NumberField
                                label="Batterie critique"
                                value={aiSettings.alertThresholds.batteryCritical}
                                min={1}
                                max={100}
                                step={1}
                                suffix="%"
                                helper="Déclenche une alerte quand la batterie descend sous ce seuil."
                                onChange={(value) => updateThreshold('batteryCritical', value)}
                            />
                            <NumberField
                                label="Température critique"
                                value={aiSettings.alertThresholds.temperatureCritical}
                                min={35}
                                max={45}
                                step={0.1}
                                suffix="°C"
                                helper="Déclenche une alerte quand la température dépasse ce seuil."
                                onChange={(value) => updateThreshold('temperatureCritical', value)}
                            />
                            <NumberField
                                label="Immobilité"
                                value={aiSettings.alertThresholds.immobilityMinutes}
                                min={1}
                                max={240}
                                step={1}
                                suffix=" min"
                                helper="Déclenche une alerte si l’animal ne bouge plus pendant cette durée."
                                onChange={(value) => updateThreshold('immobilityMinutes', value)}
                            />
                        </div>
                    </Section>

                    <Section
                        icon={<Clock3 className="h-6 w-6" />}
                        title="Fréquence du polling IA"
                        subtitle="Intervalle de rafraîchissement du moteur IA pour la détection d’anomalies."
                    >
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Intervalle de polling</p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Valeur autorisée entre {POLLING_MIN} et {POLLING_MAX} minutes.</p>
                                </div>
                                <div className="rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                    {aiSettings.pollingIntervalMinutes} min
                                </div>
                            </div>
                            <input
                                type="range"
                                min={POLLING_MIN}
                                max={POLLING_MAX}
                                step={1}
                                value={aiSettings.pollingIntervalMinutes}
                                onChange={(e) => updatePolling(Number(e.target.value))}
                                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-500 dark:bg-slate-800"
                            />
                            <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-400">
                                <span>{POLLING_MIN} min</span>
                                <span>{POLLING_MAX} min</span>
                            </div>
                        </div>
                    </Section>
                </div>

                <div className="space-y-6">
                    <Section
                        icon={<Bell className="h-6 w-6" />}
                        title="Canaux de notification"
                        subtitle="Toast toujours disponible, email et SMS activables si vos connecteurs sont configurés."
                    >
                        <div className="space-y-3">
                            <ToggleRow
                                label="Toast"
                                description="Notification visuelle dans l’interface."
                                checked={aiSettings.notificationChannels.toast}
                                onChange={(value) => updateChannel('toast', value)}
                                icon={<AlertTriangle className="h-5 w-5" />}
                            />
                            <ToggleRow
                                label="Email"
                                description="Envoi par email si le service est configuré."
                                checked={aiSettings.notificationChannels.email}
                                onChange={(value) => updateChannel('email', value)}
                                icon={<Mail className="h-5 w-5" />}
                            />
                            <ToggleRow
                                label="SMS"
                                description="Envoi SMS si le connecteur est disponible."
                                checked={aiSettings.notificationChannels.sms}
                                onChange={(value) => updateChannel('sms', value)}
                                icon={<MessageSquare className="h-5 w-5" />}
                            />
                        </div>
                    </Section>

                    <Section
                        icon={<Activity className="h-6 w-6" />}
                        title="Règles d’anomalie"
                        subtitle="Activez ou désactivez chaque règle indépendamment."
                    >
                        <div className="space-y-3">
                            {(Object.keys(ANOMALY_LABELS) as AnomalyKey[]).map((key) => (
                                <ToggleRow
                                    key={key}
                                    label={ANOMALY_LABELS[key]}
                                    description={
                                        key === 'batteryCritical'
                                            ? 'Déclenche les alertes de batterie basse.'
                                            : key === 'temperatureCritical'
                                                ? 'Déclenche les alertes de surchauffe.'
                                                : key === 'immobility'
                                                    ? 'Déclenche les alertes si l’animal reste immobile trop longtemps.'
                                                    : key === 'outOfZone'
                                                        ? 'Déclenche les alertes géofencing.'
                                                        : 'Déclenche les alertes en cas de perte de signal.'
                                    }
                                    checked={aiSettings.anomalyRules[key]}
                                    onChange={(value) => updateRule(key, value)}
                                    icon={key === 'batteryCritical'
                                        ? <Battery className="h-5 w-5" />
                                        : key === 'temperatureCritical'
                                            ? <Thermometer className="h-5 w-5" />
                                            : key === 'immobility'
                                                ? <Clock3 className="h-5 w-5" />
                                                : key === 'outOfZone'
                                                    ? <ShieldAlert className="h-5 w-5" />
                                                    : <WifiOff className="h-5 w-5" />
                                    }
                                />
                            ))}
                        </div>
                    </Section>
                </div>
            </div>

            <footer className={`flex flex-col gap-4 rounded-3xl border px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between ${flash
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100'
                : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300'
                }`}>
                <div>
                    <p className="text-sm font-bold">Sauvegarde automatique activée</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Chaque modification est écrite dans le store Zustand et dans localStorage immédiatement.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    <RotateCcw className="h-4 w-4" /> Réinitialiser
                </button>
            </footer>
        </div>
    );
}
