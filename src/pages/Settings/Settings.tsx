import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  Save, Server, Shield, Bell, Key, Sun, Moon, Sliders,
  Play, Pause, RotateCcw, Download, CheckCircle, Cpu,
  Palette, AlertTriangle, Thermometer, Battery
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useIoTStore } from '../../hooks/useIoTStore';
import api from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const STORAGE_KEY = 'smartShepherdConfig_v2';

interface AppConfig {
  mqttHost: string;
  mqttPort: string;
  mqttUser: string;
  mqttPass: string;
  batteryThreshold: number;
  tempMaxThreshold: number;
  timeoutAlert: number;
  simAnimalCount: number;
  simRefreshMs: number;
  accentColor: string;
}

const DEFAULT_CONFIG: AppConfig = {
  mqttHost: 'wss://test.mosquitto.org',
  mqttPort: '8081',
  mqttUser: '',
  mqttPass: '',
  batteryThreshold: 20,
  tempMaxThreshold: 40,
  timeoutAlert: 15,
  simAnimalCount: 200,
  simRefreshMs: 3000,
  accentColor: 'emerald',
};

// ─── Section component ───────────────────────────────────────────────────
interface SectionProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  color: 'blue' | 'amber' | 'green' | 'purple' | 'red';
  children: ReactNode;
}

function Section({ icon, title, subtitle, color, children }: SectionProps) {
  const colors: Record<string, string> = {
    blue: 'bg-[#eaf2ff] text-[#2050a8]',
    amber: 'bg-[var(--warning-bg)] text-[var(--warning)]',
    green: 'bg-[var(--success-bg)] text-[var(--success)]',
    purple: 'bg-[#f1ebff] text-[#6f4ed8]',
    red: 'bg-[var(--danger-bg)] text-[var(--danger)]',
  };
  return (
    <div className="rounded-[10px] border border-[var(--card-border)] bg-white p-6 dark:bg-[var(--card-bg)]">
      <div className="mb-6 flex items-center gap-3">
        <div className={`rounded-[8px] border border-[var(--card-border)] p-3 ${colors[color] || colors.blue}`}>{icon}</div>
        <div>
          <h3 className="text-[14px] font-medium text-[var(--text-primary)]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">{label}</label>
      {children}
      {hint && <p className="text-[11px] font-normal text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

// ─── Range with live value ────────────────────────────────────────────────
interface RangeFieldProps {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  color: string;
  hint?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function RangeField({ label, name, value, min, max, step, unit, color, hint, onChange }: RangeFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">{label}</label>
        <span className={`text-[28px] font-medium leading-none ${color}`}>{value}{unit}</span>
      </div>
      <input type="range" name={name} value={value} min={min} max={max} step={step}
        onChange={onChange}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--card-border)]"
        style={{ accentColor: color.includes('red') ? '#ef4444' : color.includes('amber') ? '#f59e0b' : '#10b981' }}
      />
      <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
      {hint && <p className="text-[11px] font-normal text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  const devices = useIoTStore(state => state.devices);
  const deviceCount = Object.keys(devices).length;

  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('connectivity');

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AppConfig>;
        // Never persist MQTT passwords in browser storage; keep them ephemeral in component state only.
        const { mqttPass: _ignoredPassword, ...rest } = parsed;
        setConfig({ ...DEFAULT_CONFIG, ...rest, mqttPass: '' });
      } catch {
        // Ignore corrupted settings rather than rehydrating unsafe data.
      }
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: isNaN(Number(value)) ? value : Number(value) }));
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const { mqttPass, ...persistedConfig } = config;

    void (async () => {
      try {
        await api.put('/settings/mqtt', config);
        // Only persist non-secret preferences; broker credentials should not remain readable in localStorage.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedConfig));

        setSaved(true);
        toast.success('Réglages MQTT enregistrés.');
        window.setTimeout(() => setSaved(false), 3000);
      } catch (error) {
        console.warn('Failed to save MQTT settings to backend, keeping local copy only.', error);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedConfig));
        setSaved(true);
        toast.error('Réglages sauvegardés localement, mais le backend est indisponible.');
        window.setTimeout(() => setSaved(false), 3000);
      }
    })();
  };

  const handleExport = () => {
    const animals = Object.values(useIoTStore.getState().devices);
    const csv = [
      'collar_id,name,breed,lat,lng,battery,health,temperature,speed,rssi,lastUpdate',
      ...animals.map(a =>
        `${a.collar_id},${a.name},${a.breed ?? ''},${a.lat},${a.lng},${a.battery},${a.health},${a.temperature ?? ''},${a.speed ?? ''},${a.rssi ?? ''},${a.lastUpdate ?? ''}`
      )
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `troupeau_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const TABS = [
    { id: 'connectivity', label: 'Connectivité', icon: <Server className="w-4 h-4" /> },
    { id: 'appearance', label: 'Apparence', icon: <Palette className="w-4 h-4" /> },
    { id: 'thresholds', label: 'Seuils', icon: <Bell className="w-4 h-4" /> },
    { id: 'data', label: 'Données', icon: <Download className="w-4 h-4" /> },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-[10px] border border-[var(--card-border)] bg-white p-6 md:flex-row md:items-center dark:bg-[var(--card-bg)]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Configuration</p>
          <h2 className="mt-1 text-[24px] font-medium leading-tight text-[var(--text-primary)]">Paramètres</h2>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Configuration système et préférences
          </p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--card-border)] bg-[var(--success-bg)] px-4 py-2 text-[12px] font-medium text-[var(--success)] animate-fade-in">
            <CheckCircle className="h-4 w-4" /> Configuration sauvegardée !
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto rounded-[10px] border border-[var(--card-border)] bg-white p-1 dark:bg-[var(--card-bg)]">
        {TABS.map(tab => (
          <Button key={tab.id} onClick={() => setActiveTab(tab.id)} size="sm"
            variant={activeTab === tab.id ? 'primary' : 'secondary'}
            className={`flex flex-1 items-center justify-center gap-2 rounded-[8px] px-4 py-2.5 text-[12px] font-medium transition-colors ${activeTab === tab.id
              ? ''
              : 'text-[var(--text-muted)]'
              }`}
          >
            {tab.icon}{tab.label}
          </Button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── CONNECTIVITY ── */}
        {activeTab === 'connectivity' && (
          <Section icon={<Server className="w-6 h-6" />} title="Serveur IoT (MQTT)" subtitle="Connexion au broker WebSocket" color="blue">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Host (WebSocket)" hint="Exemple : wss://broker.hivemq.com">
                <Input type="text" name="mqttHost" value={config.mqttHost} onChange={handleChange} />
              </Field>
              <Field label="Port">
                <Input type="text" name="mqttPort" value={config.mqttPort} onChange={handleChange} />
              </Field>
              <Field label="Nom d'utilisateur">
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type="text" name="mqttUser" value={config.mqttUser} onChange={handleChange} placeholder="Optionnel" inputClassName="pl-10" />
                </div>
              </Field>
              <Field label="Mot de passe">
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type="password" name="mqttPass" value={config.mqttPass} onChange={handleChange} placeholder="Optionnel" inputClassName="pl-10" />
                </div>
              </Field>
            </div>
          </Section>
        )}

        {/* ── APPEARANCE ── */}
        {activeTab === 'appearance' && (
          <Section icon={<Palette className="w-6 h-6" />} title="Apparence" subtitle="Thème et préférences visuelles" color="purple">
            <div className="space-y-6">
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">Mode d'affichage</p>
                <div className="flex gap-3">
                  {([
                    { value: 'light', label: 'Clair', icon: <Sun className="w-5 h-5" /> },
                    { value: 'dark', label: 'Sombre', icon: <Moon className="w-5 h-5" /> },
                  ] as const).map(opt => (
                    <Button key={opt.value} type="button" onClick={() => theme !== opt.value && toggleTheme()} variant={theme === opt.value ? 'primary' : 'secondary'}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] border px-4 py-4 text-[12px] font-medium transition-colors ${theme === opt.value
                        ? 'border-[var(--brand-primary)]'
                        : 'border-[var(--card-border)] text-[var(--text-muted)]'
                        }`}>
                      {opt.icon} {opt.label}
                      {theme === opt.value && <CheckCircle className="ml-auto h-4 w-4 text-[var(--brand-primary)]" />}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* ── THRESHOLDS ── */}
        {activeTab === 'thresholds' && (
          <Section icon={<Bell className="w-6 h-6" />} title="Seuils d'Alertes" subtitle="Configurez quand les alertes se déclenchent" color="amber">
            <div className="space-y-8">
              <RangeField label="Alerte Batterie Faible" name="batteryThreshold"
                value={config.batteryThreshold} onChange={handleChange}
                min={5} max={50} step={1} unit="%" color="text-amber-500"
                hint="Pourcentage en dessous duquel une alerte LOW_BATTERY sera générée."
              />
              <RangeField label="Température Maximale" name="tempMaxThreshold"
                value={config.tempMaxThreshold} onChange={handleChange}
                min={38} max={45} step={0.5} unit="°C" color="text-orange-500"
                hint="Température corporelle au-dessus de laquelle une alerte HEALTH_WARNING est émise."
              />
              <RangeField label="Délai Perte de Signal" name="timeoutAlert"
                value={config.timeoutAlert} onChange={handleChange}
                min={5} max={60} step={5} unit=" min" color="text-red-500"
                hint="Temps sans transmission GPS avant de marquer le collier COLLAR_OFFLINE."
              />
            </div>
          </Section>
        )}

        {/* ── DATA EXPORT ── */}
        {activeTab === 'data' && (
          <Section icon={<Download className="w-6 h-6" />} title="Export des Données" subtitle="Téléchargez les données du troupeau" color="green">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-[10px] border border-[var(--card-border)] bg-[#fafaf8] p-4 dark:bg-white/3">
                <div>
                  <p className="text-[12px] font-medium text-[var(--text-primary)]">Export CSV — Troupeau actuel</p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {deviceCount} animaux · Positions, batterie, santé, RSSI
                  </p>
                </div>
                <Button type="button" onClick={handleExport} variant="primary" className="flex items-center gap-2 px-5 py-3 text-[12px] font-medium">
                  <Download className="w-4 h-4" /> Télécharger
                </Button>
              </div>
              <p className="text-center text-[11px] text-[var(--text-muted)]">
                Toutes les données sont stockées localement dans votre navigateur. Aucune donnée n'est transmise à des serveurs tiers.
              </p>
            </div>
          </Section>
        )}

        {/* Save Button */}
        {activeTab !== 'data' && (
          <div className="flex justify-end pt-2">
            <Button type="submit" variant={saved ? 'secondary' : 'primary'}
              className={`flex items-center gap-2 px-8 py-4 text-[12px] font-medium transition-colors ${saved
                ? 'border border-[var(--card-border)] bg-[var(--success-bg)] text-[var(--success)]'
                : ''
                }`}>
              {saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              {saved ? 'Enregistré !' : 'Sauvegarder'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
};

export default Settings;
