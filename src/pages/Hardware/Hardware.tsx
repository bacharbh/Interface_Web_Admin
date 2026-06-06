import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Cpu, Wifi, Activity, Search, Radio, AlertTriangle, CheckCircle, Signal } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useIoTStore } from '../../hooks/useIoTStore';
import { IAnimal } from '../../types';
import api from '../../services/api';

type HardwareStatus = 'DEPLOYED' | 'LOW_BATT' | 'OFFLINE' | 'UNASSIGNED';

const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 min

const getStatusFromDevice = (animal: IAnimal | undefined): HardwareStatus => {
  if (!animal) return 'UNASSIGNED';
  const lastUpdate = (animal as any).lastUpdate || (animal as any).lastSeen || (animal as any).updatedAt;
  if (!lastUpdate) return 'OFFLINE';
  const age = Date.now() - new Date(lastUpdate).getTime();
  if (age > STALE_THRESHOLD_MS) return 'OFFLINE';
  const rssi = (animal as any).rssi ?? (animal as any).lora?.rssi;
  if (typeof rssi === 'number' && rssi < -85) return 'LOW_BATT';
  return 'DEPLOYED';
};

const getStatusStyle = (status: HardwareStatus) => {
  switch (status) {
    case 'DEPLOYED': return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30';
    case 'LOW_BATT': return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30';
    case 'OFFLINE': return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30';
    case 'UNASSIGNED': return 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const getStatusLabel = (status: HardwareStatus) => {
  switch (status) {
    case 'DEPLOYED': return 'Déployé';
    case 'LOW_BATT': return 'Signal faible';
    case 'OFFLINE': return 'Hors ligne';
    case 'UNASSIGNED': return 'Non assigné';
  }
};

const getSignalStrength = (rssi: number | undefined) => {
  if (!rssi || rssi === 0) return { color: 'text-gray-400', text: 'N/A', bars: 0 };
  if (rssi > -65) return { color: 'text-green-500', text: 'Excellent', bars: 4 };
  if (rssi > -75) return { color: 'text-green-400', text: 'Bon', bars: 3 };
  if (rssi > -85) return { color: 'text-amber-500', text: 'Moyen', bars: 2 };
  return { color: 'text-red-500', text: 'Faible', bars: 1 };
};

function SignalBars({ bars }: { bars: number }) {
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3, 4].map(b => (
        <div
          key={b}
          className={`w-1 rounded-sm transition-all ${b <= bars ? 'bg-current opacity-100' : 'opacity-20'}`}
          style={{ height: `${b * 4 + 4}px` }}
        />
      ))}
    </div>
  );
}

interface HardwareItem {
  id: string;
  animalName: string;
  breed?: string;
  temperature?: number;
  signal?: number;
  firmware: string;
  status: HardwareStatus;
  lat?: number;
  lng?: number;
  lastUpdate?: string;
}

const Hardware = () => {
  const navigate = useNavigate();
  const devicesMap = useIoTStore(state => state.devices);
  const isConnected = useIoTStore(state => state.isConnected);
  const isOfflineData = useIoTStore(state => state.isOfflineData);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<HardwareStatus | 'ALL'>('ALL');

  const { data: apiSheep = [] } = useQuery({
    queryKey: ['hardware-sheep-fallback'],
    queryFn: async () => {
      const response = await api.get('/sheep');
      const payload = response.data?.data ?? response.data?.sheep ?? response.data;
      return Array.isArray(payload) ? payload : [];
    },
    enabled: Object.keys(devicesMap).length === 0 && (isConnected || isOfflineData),
    staleTime: 30_000,
  });

  const hardwareList = useMemo<HardwareItem[]>(() => {
    return Object.values(devicesMap).map(animal => ({
      id: animal.collar_id,
      animalName: animal.name ?? animal.collar_id,
      breed: animal.breed,
      temperature: (animal as any).temperature,
      signal: (animal as any).rssi ?? (animal as any).lora?.rssi,
      firmware: (animal as any).firmware || (animal as any).firmwareVersion || 'N/A',
      status: getStatusFromDevice(animal),
      lat: animal.lat,
      lng: animal.lng,
      lastUpdate: animal.lastUpdate,
    }));
  }, [devicesMap]);

  const fallbackHardware = useMemo<HardwareItem[]>(() => {
    return (apiSheep as IAnimal[]).map(animal => ({
      id: animal.collar_id,
      animalName: animal.name ?? animal.collar_id,
      breed: animal.breed,
      temperature: (animal as any).temperature,
      signal: (animal as any).rssi ?? (animal as any).lora?.rssi,
      firmware: (animal as any).firmware || (animal as any).firmwareVersion || 'N/A',
      status: getStatusFromDevice(animal),
      lat: animal.lat,
      lng: animal.lng,
      lastUpdate: animal.lastUpdate,
    }));
  }, [apiSheep]);

  const displayHardware = hardwareList.length > 0 ? hardwareList : fallbackHardware;

  const kpis = useMemo(() => ({
    total: displayHardware.length,
    deployed: displayHardware.filter(d => d.status === 'DEPLOYED').length,
    weakSignal: displayHardware.filter(d => d.status === 'LOW_BATT').length,
    offline: displayHardware.filter(d => d.status === 'OFFLINE').length,
  }), [displayHardware]);

  const isEmpty = displayHardware.length === 0;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-16 px-4 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Flotte matérielle</h2>
          <p className="text-sm text-gray-500 mt-1">
            {kpis.total} Colliers IoT · Données temps réel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-gray-600">Flux direct</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <Cpu className="w-8 h-8 text-gray-300" />, label: 'Total appareils', value: kpis.total, color: 'text-gray-900 dark:text-white' },
          { icon: <CheckCircle className="w-8 h-8 text-gray-200" />, label: 'Déployés', value: kpis.deployed, color: 'text-green-600 dark:text-green-400' },
          { icon: <Signal className="w-8 h-8 text-gray-200" />, label: 'Signal faible', value: kpis.weakSignal, color: 'text-amber-600 dark:text-amber-400' },
          { icon: <AlertTriangle className="w-8 h-8 text-gray-200" />, label: 'Hors ligne', value: kpis.offline, color: 'text-red-600 dark:text-red-400' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-500 mb-1 block">{label}</span>
              <span className={`text-2xl font-bold ${color}`}>{value}</span>
            </div>
            {icon}
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher Collier ID ou Animal…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none dark:text-white transition-all"
            />
          </div>
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl overflow-x-auto gap-1">
            {(['ALL', 'DEPLOYED', 'LOW_BATT', 'OFFLINE'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${filter === f
                  ? 'bg-white dark:bg-gray-600 text-emerald-700 dark:text-emerald-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
              >
                {f === 'ALL' ? 'Tous' : getStatusLabel(f as HardwareStatus)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {isEmpty ? (
            <div className="py-24 text-center space-y-3">
              <Radio className="w-14 h-14 mx-auto mb-2 text-gray-300 animate-pulse" />
              <p className="text-sm font-medium text-gray-500">Aucun appareil détecté</p>
              <p className="text-xs text-gray-400">Vérifiez la connexion MQTT.</p>
              <Button variant="secondary" onClick={() => navigate('/settings')} className="inline-flex items-center gap-2 mt-1 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                Aller aux paramètres
              </Button>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                <tr>
                  {['Collier', 'Animal', 'Statut', 'Température', 'Signal', 'Dernière MAJ', 'Firmware', 'Action'].map(h => (
                    <th key={h} className="px-6 py-4 label-xs font-black">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {displayHardware.filter(d => {
                  const matchesSearch = d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    d.animalName?.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesFilter = filter === 'ALL' || d.status === filter;
                  return matchesSearch && matchesFilter;
                }).slice(0, 50).map((device) => {
                  const sig = getSignalStrength(device.signal);
                  return (
                    <tr
                      key={device.id}
                      className="cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                      onClick={() => navigate(`/animals/${device.id}`)}
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Cpu className="w-4 h-4 text-slate-500" />
                          </div>
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{device.id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary label-xs font-bold">
                          {device.animalName}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex px-2 py-1 rounded-md label-xs font-black ${getStatusStyle(device.status)}`}>
                          {getStatusLabel(device.status)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <Activity className={`w-4 h-4 ${typeof device.temperature === 'number' && device.temperature > 39.5 ? 'text-red-500' : 'text-emerald-500'}`} />
                          <span className="font-bold dark:text-white text-sm">
                            {typeof device.temperature === 'number' ? `${device.temperature.toFixed(1)} °C` : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className={`flex items-center gap-2 ${sig.color}`}>
                          <SignalBars bars={sig.bars} />
                          <span className="text-xs font-bold dark:text-slate-300">
                            {sig.text} <span className="text-slate-400 font-mono ml-1">({typeof device.signal === 'number' ? `${device.signal} dBm` : 'N/A'})</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-xs text-slate-500">
                          {device.lastUpdate ? new Date(device.lastUpdate).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-xs font-mono font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded dark:text-slate-300">
                          {device.firmware}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <Button
                          variant="ghost"
                          className="label-xs font-black text-primary px-3 py-1.5 rounded-lg"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/animals/${device.id}`);
                          }}
                        >
                          Détails →
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {displayHardware.length > 50 && (
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[11px] font-bold text-gray-400">Affichage des 50 premiers sur {displayHardware.length} résultats. Affinez la recherche pour voir plus.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Hardware;
