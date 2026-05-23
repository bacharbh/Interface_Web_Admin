import React, { useState, useMemo } from 'react';
import { Cpu, Battery, Wifi, Activity, Search, RefreshCw, Layers, Radio, AlertTriangle, CheckCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useIoTStore } from '../../hooks/useIoTStore';
import { IAnimal } from '../../types';

type HardwareStatus = 'DEPLOYED' | 'LOW_BATT' | 'OFFLINE' | 'UNASSIGNED';

const getStatusFromDevice = (animal: IAnimal | undefined): HardwareStatus => {
  if (!animal) return 'UNASSIGNED';
  const battery = animal.battery ?? 0;
  if (battery < 10) return 'OFFLINE';
  if (battery < 20) return 'LOW_BATT';
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
  battery: number;
  signal?: number;
  firmware: string;
  status: HardwareStatus;
  lat: number;
  lng: number;
  lastUpdate?: string;
}

const Hardware = () => {
  const devicesMap = useIoTStore(state => state.devices);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<HardwareStatus | 'ALL'>('ALL');

  // Derive hardware list from live device store
  const hardwareList = useMemo<HardwareItem[]>(() => {
    return Object.values(devicesMap).map(animal => ({
      id: animal.collar_id,
      animalName: animal.name,
      breed: animal.breed,
      battery: animal.battery,
      signal: animal.rssi,
      firmware: 'v2.1.4',
      status: getStatusFromDevice(animal),
      lat: animal.lat,
      lng: animal.lng,
      lastUpdate: animal.lastUpdate,
    }));
  }, [devicesMap]);

  const filtered = useMemo(() => hardwareList.filter(d => {
    const matchesSearch = d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.animalName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'ALL' || d.status === filter;
    return matchesSearch && matchesFilter;
  }), [hardwareList, searchTerm, filter]);

  const kpis = useMemo(() => ({
    total: hardwareList.length,
    deployed: hardwareList.filter(d => d.status === 'DEPLOYED').length,
    lowBatt: hardwareList.filter(d => d.status === 'LOW_BATT').length,
    offline: hardwareList.filter(d => d.status === 'OFFLINE').length,
  }), [hardwareList]);

  const isEmpty = hardwareList.length === 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass p-6 rounded-3xl border border-white/20 dark:border-slate-800/50 shadow-xl shadow-primary/5">
        <div>
          <h2 className="title-lg text-slate-900 dark:text-white tracking-tight leading-none">Flotte matérielle</h2>
          <p className="label-xs mt-2">
            {kpis.total} Colliers IoT · Données temps réel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="label-xs">Flux direct</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Cpu className="w-5 h-5 text-primary" />, label: 'Total appareils', value: kpis.total, color: 'text-slate-800 dark:text-white' },
          { icon: <CheckCircle className="w-5 h-5 text-green-500" />, label: 'Déployés', value: kpis.deployed, color: 'text-green-600 dark:text-green-400' },
          { icon: <Battery className="w-5 h-5 text-amber-500" />, label: 'Alerte batterie', value: kpis.lowBatt, color: 'text-amber-600 dark:text-amber-400' },
          { icon: <AlertTriangle className="w-5 h-5 text-red-500" />, label: 'Hors ligne', value: kpis.offline, color: 'text-red-600 dark:text-red-400' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="glass p-5 rounded-2xl border border-white/20 dark:border-slate-800 flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">{React.cloneElement(icon, { className: 'w-16 h-16' })}</div>
            <div className="flex items-center gap-2">{icon}<span className="label-xs">{label}</span></div>
            <span className={`value-xl tabular-nums ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Filters & Table */}
      <div className="glass rounded-3xl border border-white/20 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50">
        <div className="p-4 border-b border-white/20 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/40 dark:bg-slate-800/40">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher Collier ID ou Animal…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none dark:text-white transition-all shadow-sm"
            />
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto w-full sm:w-auto gap-1">
            {(['ALL', 'DEPLOYED', 'LOW_BATT', 'OFFLINE'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl label-xs font-black transition-all whitespace-nowrap ${filter === f
                  ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                {f === 'ALL' ? 'Tous' : f.replace('_', ' ').toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {isEmpty ? (
            <div className="py-20 text-center">
              <Radio className="w-12 h-12 mx-auto mb-4 text-gray-200 animate-pulse" />
              <p className="label-sm font-black text-gray-400">En attente de la simulation…</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                <tr>
                  {['Collier', 'Animal', 'Statut', 'Batterie', 'Signal', 'Position', 'Firmware', 'Action'].map(h => (
                    <th key={h} className="px-6 py-4 label-xs font-black">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filtered.slice(0, 50).map((device) => {
                  const sig = getSignalStrength(device.signal);
                  return (
                    <tr key={device.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
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
                          {device.status.replace('_', ' ').toLowerCase()}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        {(() => {
                          const battery = device.battery ?? 0;
                          return (
                            <div className="flex items-center gap-2">
                              <Battery className={`w-4 h-4 ${battery < 20 ? 'text-red-500' : 'text-green-500'}`} />
                              <div>
                                <span className="font-bold dark:text-white text-sm">{battery}%</span>
                                <div className="w-20 bg-slate-200 dark:bg-slate-700 rounded-full h-1 mt-1 overflow-hidden">
                                  <div
                                    className={`h-1 rounded-full transition-all ${battery < 20 ? 'bg-red-500' : 'bg-green-500'}`}
                                    style={{ width: `${battery}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className={`flex items-center gap-2 ${sig.color}`}>
                          <SignalBars bars={sig.bars} />
                          <span className="text-xs font-bold dark:text-slate-300">
                            {sig.text} <span className="text-slate-400 font-mono ml-1">({device.signal} dBm)</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-[10px] font-mono text-slate-500">
                          {device.lat?.toFixed(4)}, {device.lng?.toFixed(4)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-xs font-mono font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded dark:text-slate-300">
                          {device.firmware}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <Button variant="ghost" className="label-xs font-black text-primary px-3 py-1.5 rounded-lg">Détails</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > 50 && (
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[11px] font-bold text-gray-400">Affichage des 50 premiers sur {filtered.length} résultats. Affinez la recherche pour voir plus.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Hardware;
