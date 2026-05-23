import React, { useMemo } from 'react';
import { Battery, Wifi, AlertTriangle } from 'lucide-react';
import { IAnimal } from '../../types';

interface DeviceStatusWidgetProps {
  animals: IAnimal[];
}

export default function DeviceStatusWidget({ animals }: DeviceStatusWidgetProps) {
  const stats = useMemo(() => {
    let batteryCritical = 0;
    let batteryLow = 0;
    let batteryGood = 0;

    let signalPoor = 0;
    let signalFair = 0;
    let signalGood = 0;

    animals.forEach(a => {
      const battery = a.battery ?? 0;
      if (battery < 15) batteryCritical++;
      else if (battery < 40) batteryLow++;
      else batteryGood++;

      const rssi = a.rssi ?? -90;
      if (rssi < -85) signalPoor++;
      else if (rssi < -70) signalFair++;
      else signalGood++;
    });

    const total = animals.length || 1; // prevent div by 0

    return {
      battery: { critical: batteryCritical, low: batteryLow, good: batteryGood, total: animals.length },
      signal: { poor: signalPoor, fair: signalFair, good: signalGood, total: animals.length }
    };
  }, [animals]);

  if (animals.length === 0) {
    return <div className="p-6 bg-white dark:bg-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse h-full min-h-[250px]" />;
  }

  const bPercent = (val: number) => `${((val / (stats.battery.total || 1)) * 100).toFixed(0)}%`;
  const sPercent = (val: number) => `${((val / (stats.signal.total || 1)) * 100).toFixed(0)}%`;

  return (
    <div className="bg-white dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between h-full min-h-[250px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-primary" /> État des Appareils
        </h3>
      </div>

      <div className="space-y-6 flex-1 flex flex-col justify-center">
        {/* Battery Section */}
        <div>
          <div className="flex justify-between text-[11px] font-bold text-gray-500 uppercase mb-2">
            <span className="flex items-center gap-1"><Battery size={12} /> Batterie</span>
            <span>{stats.battery.good} OK</span>
          </div>
          <div className="h-2 flex rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
            <div style={{ width: bPercent(stats.battery.good) }} className="bg-green-500 transition-all duration-500" title="Bon" />
            <div style={{ width: bPercent(stats.battery.low) }} className="bg-amber-400 transition-all duration-500" title="Faible" />
            <div style={{ width: bPercent(stats.battery.critical) }} className="bg-red-500 transition-all duration-500" title="Critique" />
          </div>
          <div className="flex justify-between mt-1 text-[9px] font-bold text-gray-400 uppercase">
            <span>{stats.battery.critical} Critique</span>
            <span>{stats.battery.low} Faible</span>
          </div>
        </div>

        {/* Signal Section */}
        <div>
          <div className="flex justify-between text-[11px] font-bold text-gray-500 uppercase mb-2">
            <span className="flex items-center gap-1"><Wifi size={12} /> Signal (RSSI)</span>
            <span>{stats.signal.good} Fort</span>
          </div>
          <div className="h-2 flex rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
            <div style={{ width: sPercent(stats.signal.good) }} className="bg-blue-500 transition-all duration-500" title="Fort" />
            <div style={{ width: sPercent(stats.signal.fair) }} className="bg-blue-300 transition-all duration-500" title="Moyen" />
            <div style={{ width: sPercent(stats.signal.poor) }} className="bg-gray-300 dark:bg-gray-600 transition-all duration-500" title="Faible/Perdu" />
          </div>
          <div className="flex justify-between mt-1 text-[9px] font-bold text-gray-400 uppercase">
            <span>{stats.signal.poor} Faible</span>
            <span>{stats.signal.fair} Moyen</span>
          </div>
        </div>
      </div>
    </div>
  );
}
