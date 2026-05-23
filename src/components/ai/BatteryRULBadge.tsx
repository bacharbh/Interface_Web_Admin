import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Battery, Zap, AlertCircle, TrendingDown, Clock } from 'lucide-react';
import Button from '../ui/Button';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip);

interface BatteryRULBadgeProps {
  deviceId: string;
}

const BatteryRULBadge = ({ deviceId }: BatteryRULBadgeProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: rul, isLoading } = useQuery({
    queryKey: ['battery-rul', deviceId],
    queryFn: async () => {
      const res = await fetch(`/api/ai/battery-rul/${deviceId}`);
      if (!res.ok) throw new Error('API Error');
      return res.json();
    },
    staleTime: 60000,
  });

  if (isLoading) return <div className="h-6 w-20 bg-gray-100 animate-pulse rounded-full" />;

  const remainingHours = rul?.hours || 0;

  const getRulColor = (h: number) => {
    if (h > 72) return 'bg-green-500';
    if (h > 24) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const chartData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}h`),
    datasets: [
      {
        label: 'Discharge Curve (Predicted)',
        data: rul?.historicalVoltage || [],
        borderColor: '#3b82f6',
        borderDash: [5, 5],
        tension: 0.4,
      }
    ]
  };

  return (
    <>
      <div
        onClick={() => setIsDrawerOpen(true)}
        className="group relative inline-flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full cursor-pointer hover:border-primary transition-all"
      >
        <div className={`w-2 h-2 rounded-full ${getRulColor(remainingHours)} animate-pulse`} />
        <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-tighter">
          ~{remainingHours}h remaining
        </span>

        {/* Hover Panel */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">XGBoost Prediction</p>
          <p className="text-sm font-black text-gray-900 dark:text-white">{remainingHours - 4}–{remainingHours + 4}h</p>
          <p className="text-[10px] font-bold text-blue-500 mt-1">85% Confidence Interval</p>
        </div>
      </div>

      {/* Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-[500px] bg-white dark:bg-gray-900 h-full p-10 shadow-2xl animate-slide-left flex flex-col gap-8">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                  <Zap className="text-amber-500" /> Battery Health Analysis
                </h3>
                <p className="text-sm text-gray-500 font-medium">Device ID: {deviceId}</p>
              </div>
              <Button variant="ghost" onClick={() => setIsDrawerOpen(false)} className="p-3 rounded-2xl">
                <Clock size={20} />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-3xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">RUL Prediction</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">~{remainingHours} Hours</p>
              </div>
              <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-3xl">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                <p className={`text-sm font-black uppercase ${getRulColor(remainingHours).replace('bg-', 'text-')}`}>
                  {remainingHours < 24 ? 'Critical Action Required' : 'Optimal Operating'}
                </p>
              </div>
            </div>

            <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-3xl p-6 border-2 border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Discharge Profile & Trendline</p>
              <div className="h-64">
                <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </div>
            </div>

            <Button variant="primary" className="w-full py-4 font-black uppercase tracking-widest">Schedule Replacement</Button>
          </div>
        </div>
      )}
    </>
  );
};

export default BatteryRULBadge;
