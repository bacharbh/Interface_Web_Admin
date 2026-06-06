import { MapPin } from 'lucide-react';

const GPSHeatmap = () => {
  return (
    <div className="h-[400px] w-full rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <MapPin className="w-8 h-8 text-slate-400 dark:text-slate-500" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Heatmap GPS non disponible</p>
        <p className="text-xs text-slate-400 dark:text-slate-600 mt-1 max-w-[220px]">
          Les colliers IoT ne transmettent pas de coordonnées GPS
        </p>
      </div>
    </div>
  );
};

export default GPSHeatmap;
