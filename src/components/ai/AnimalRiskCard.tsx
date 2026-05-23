import React, { useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, Heart, Thermometer, Activity, AlertTriangle, ChevronRight } from 'lucide-react';
import Button from '../ui/Button';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface AnimalRiskCardProps {
  animalId: string;
  name: string;
}

const AnimalRiskCard = ({ animalId, name }: AnimalRiskCardProps) => {
  const { data: risk, isLoading, isError } = useQuery({
    queryKey: ['ai-risk', animalId],
    queryFn: async () => {
      const res = await fetch(`/api/ai/health-check/${animalId}`);
      if (!res.ok) throw new Error('AI Service Offline');
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 25000,
  });

  const deferredRisk = useDeferredValue(risk);

  if (isLoading) {
    return <div className="min-h-[350px] w-full bg-white dark:bg-card-dark rounded-3xl animate-pulse flex items-center justify-center">
      <Brain className="w-10 h-10 text-gray-200" />
    </div>;
  }

  if (isError) {
    return (
      <div className="min-h-[350px] p-8 bg-gray-50 dark:bg-gray-800 rounded-3xl flex flex-col items-center justify-center text-center gap-4">
        <div className="px-3 py-1 bg-red-100 text-red-600 rounded-full label-xs font-black">AI Offline</div>
        <p className="label-xs">Using rule-based thresholds fallback.</p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score < 30) return 'text-green-500';
    if (score < 70) return 'text-amber-500';
    return 'text-red-500';
  };

  const shapData = {
    labels: ['Temp', 'BPM', 'Activity'],
    datasets: [{
      data: deferredRisk?.shapValues || [0, 0, 0],
      backgroundColor: (context: any) => {
        const val = context.raw;
        return val > 0 ? '#fbbf24' : '#60a5fa'; // Warm for positive, cool for negative
      },
      borderRadius: 8,
    }]
  };

  const shapOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.label} contributed ${ctx.raw > 0 ? '+' : ''}${Math.round(ctx.raw * 100)}% to risk`
        }
      }
    },
    scales: { x: { display: false }, y: { grid: { display: false } } }
  };

  return (
    <div className="min-h-[400px] bg-white dark:bg-card-dark rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-gray-800 flex flex-col gap-6">
      {/* Gauge Header */}
      <div className="flex flex-col items-center text-center">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90">
            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-100 dark:text-gray-800" />
            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="364.4" strokeDashoffset={364.4 - (364.4 * (deferredRisk?.riskScore || 0) / 100)} className={`${getScoreColor(deferredRisk?.riskScore)} transition-all duration-1000 ease-out`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`value-xl font-black ${getScoreColor(deferredRisk?.riskScore)}`}>{Math.round(deferredRisk?.riskScore || 0)}</span>
            <span className="label-xs font-bold">Score</span>
          </div>
        </div>
        <h3 className="mt-4 title-lg text-gray-900 dark:text-white">{name}</h3>
      </div>

      {/* SHAP Bars */}
      <div className="flex-1 space-y-4">
        <p className="label-xs text-center">AI Interpretation (SHAP)</p>
        <div className="h-40">
          <Bar data={shapData} options={shapOptions} />
        </div>
      </div>

      {/* Action CTA */}
      {deferredRisk?.riskScore > 70 && (
        <div className="mt-4 p-4 bg-red-500 rounded-2xl animate-pulse">
          <p className="text-white label-xs text-center mb-3">Veterinary Check Recommended</p>
          <Button variant="danger" className="w-full py-3 flex items-center justify-center gap-2">Create Clinical Alert <ChevronRight size={14} /></Button>
        </div>
      )}
    </div>
  );
};

export default AnimalRiskCard;
