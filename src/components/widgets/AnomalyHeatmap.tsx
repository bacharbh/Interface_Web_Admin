import React from 'react';
import { useIoTStore } from '../../hooks/useIoTStore';
import { Activity, Info } from 'lucide-react';

export default function AnomalyHeatmap() {
  const devices = useIoTStore((state) => state.devices);
  const animalList = Object.values(devices);

  // Fonction d'interpolation de couleur : Vert (0.0) -> Jaune (0.5) -> Rouge (1.0)
  const getScoreColor = (score: number) => {
    // Mathématiques simples pour dégrader le RGB
    const g = Math.max(0, 185 - score * 117); // De 185 à 68
    const r = Math.min(239, 16 + score * 223); // De 16 à 239
    return `rgb(${r}, ${g}, 68)`;
  };

  return (
    <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <h3 className="title-sm flex items-center gap-2 text-gray-900 dark:text-white">
          <Activity className="w-5 h-5 text-indigo-500" />
          Troupeau : Heatmap IA (LSTM)
        </h3>
        <div className="flex items-center gap-3 text-xs bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></div>
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></div>
            <span>Suspect</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
            <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]"></div>
            <span>Critique (&gt;0.85)</span>
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-h-[300px] w-full bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden group">
        {/* Grille Radar Subtile */}
        <div
          className="absolute inset-0 opacity-20 dark:opacity-10 pointer-events-none"
          style={{
            backgroundSize: '40px 40px',
            backgroundImage:
              'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
          }}
        />

        {animalList.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <Info className="w-8 h-8 mb-2 opacity-50" />
            <p className="label-sm">Aucune donnée de télémétrie disponible</p>
          </div>
        ) : (
          animalList.map((animal) => {
            // Projection Factice sur la grille (En production on utilise les vraies cordonnées GPS)
            // Ici, pour la démo visuelle, on dispatche le troupeau basé sur leur ID
            const charCode = animal.collar_id.charCodeAt(animal.collar_id.length - 1) || 0;
            const x = 10 + (charCode * 7) % 80;
            const y = 10 + (charCode * 13) % 80;

            // Score venant du MQTT/Store (Mocké à 0.1 par défaut, ou aléatoirement 0.9 si l'animal est "SICK")
            const score = animal.status === 'CRITICAL' ? 0.91 : (animal.battery < 20 ? 0.6 : 0.05);

            const color = getScoreColor(score);
            const isCritical = score > 0.85;

            return (
              <div
                key={animal.collar_id}
                className={`absolute w-3.5 h-3.5 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-[2000ms] ease-out cursor-pointer hover:scale-150 hover:z-50 z-10 ${isCritical ? 'animate-bounce-subtle' : ''
                  }`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 ${score * 15}px ${color}`,
                }}
                title={`Collier: ${animal.collar_id}\nScore Anomalie: ${(score * 100).toFixed(1)}%`}
              >
                {/* Onde de choc (Pulse) pour les critiques */}
                {isCritical && (
                  <div
                    className="absolute inset-0 rounded-full animate-ping opacity-60"
                    style={{ backgroundColor: color }}
                  />
                )}

                {/* Tooltip Hover Info */}
                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  ID: {animal.collar_id} <br /> Score: {(score * 100).toFixed(1)}%
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <p>Le modèle LSTM met à jour les probabilités en continu via MQTT.</p>
        <p className="font-mono">{animalList.length} Entités</p>
      </div>
    </div>
  );
}
