import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  ChevronRight,
  History,
  Loader2,
  Stethoscope,
  BrainCircuit,
  Trophy,
  Filter
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import labellingService, { type LabellingOutcome } from '../../services/labellingService';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

interface FlaggedAnimal {
  id: string;
  name: string;
  anomalyDate: string;
  severity: 'High' | 'Medium' | 'Critical';
  type: string;
}

const OUTCOME_OPTIONS: LabellingOutcome[] = [
  'Healthy',
  'Fever',
  'Respiratory illness',
  'Digestive disorder',
  'Injury',
  'Unknown',
];

const LabellingPage = () => {
  const [flaggedAnimals, setFlaggedAnimals] = useState<FlaggedAnimal[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<FlaggedAnimal | null>(null);
  const [loading, setLoading] = useState(true);
  const [symptomOnset, setSymptomOnset] = useState<number | null>(null);
  const [labelledCount, setLabelledCount] = useState(34);
  const [totalFlagged] = useState(127);

  // Form State
  const [outcome, setOutcome] = useState('Healthy');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const diagnoseMutation = useMutation({
    mutationFn: (payload: Parameters<typeof labellingService.diagnose>[0]) => labellingService.diagnose(payload),
  });

  useEffect(() => {
    // Mock data fetching
    const mockAnimals: FlaggedAnimal[] = [
      { id: 'C001', name: 'Agneau #12', anomalyDate: '2026-04-26', severity: 'High', type: 'Temperature Spike' },
      { id: 'C045', name: 'Brebis #45', anomalyDate: '2026-04-25', severity: 'Medium', type: 'Lethargy Detected' },
      { id: 'C089', name: 'Bélier #89', anomalyDate: '2026-04-24', severity: 'Critical', type: 'Suspected Fall' },
    ];
    setFlaggedAnimals(mockAnimals);
    setSelectedAnimal(mockAnimals[0]);
    setLoading(false);
  }, []);

  const chartData = {
    labels: Array.from({ length: 48 }, (_, i) => `${i}h`),
    datasets: [
      {
        label: 'Température (°C)',
        data: Array.from({ length: 48 }, () => 38.5 + Math.random() * 2),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'BPM',
        data: Array.from({ length: 48 }, () => 70 + Math.random() * 40),
        borderColor: '#3b82f6',
        tension: 0.4,
      }
    ]
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { weight: 'bold' } } },
      annotation: {
        annotations: symptomOnset !== null ? {
          line1: {
            type: 'line',
            xMin: symptomOnset,
            xMax: symptomOnset,
            borderColor: 'rgb(255, 99, 132)',
            borderWidth: 2,
            label: { content: 'Onset', display: true }
          }
        } : {}
      }
    } as any, // annotation plugin types can be tricky
    scales: {
      y: { grid: { color: 'rgba(0,0,0,0.05)' } },
      x: { grid: { display: false } }
    },
    onClick: (e: any, elements: any, chart: any) => {
      const points = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
      if (points.length) {
        setSymptomOnset(points[0].index);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await diagnoseMutation.mutateAsync({
        animalId: selectedAnimal.id,
        outcome: outcome as LabellingOutcome,
        confirmedByVet: isConfirmed,
        symptomOnsetTime: symptomOnset,
        notes: notes.trim(),
        anomalyDate: selectedAnimal.anomalyDate,
        severity: selectedAnimal.severity,
        type: selectedAnimal.type,
        windowStart: `${selectedAnimal.anomalyDate}T00:00:00.000Z`,
        windowEnd: `${selectedAnimal.anomalyDate}T23:59:59.999Z`,
      });
      toast.success(`Diagnostic soumis pour ${selectedAnimal.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Impossible de soumettre le diagnostic pour ${selectedAnimal.name}`);
      return;
    } finally {
      setIsSubmitting(false);
    }

    setLabelledCount(prev => prev + 1);
    setNotes('');
    setSymptomOnset(null);
    setOutcome('Healthy');
    setIsConfirmed(false);
    // Move to next animal
    const currentIndex = flaggedAnimals.findIndex(a => a.id === selectedAnimal.id);
    if (currentIndex < flaggedAnimals.length - 1) {
      setSelectedAnimal(flaggedAnimals[currentIndex + 1]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-6 animate-fade-in">
      {!import.meta.env.PROD && (
        <div style={{
          background: '#fff3cd',
          borderLeft: '4px solid #f0c040',
          padding: '8px 16px',
          fontSize: 12,
          color: '#856404',
          marginBottom: 16,
        }}>
          ⚠️ Sandbox — les diagnostics sont enregistrés en base
          mais ce module est en phase de validation terrain.
        </div>
      )}

      {/* Header Stats */}
      <div className="flex items-center justify-between bg-white dark:bg-card-dark p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <Stethoscope className="text-primary" /> Ground-Truth Labelling
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Labelled: <span className="text-primary font-black">{labelledCount}</span> / {totalFlagged} flagged animals this month
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Farm Leaderboard</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">📍 Bergerie du Nord: <span className="text-green-500">92%</span></p>
          </div>
          <Trophy className="w-8 h-8 text-amber-500" />
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Left Panel: List */}
        <div className="w-80 bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-gray-800 flex flex-col shadow-sm">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Anomalies Recentes</h3>
            <Filter size={14} className="text-gray-400" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {flaggedAnimals.map(animal => (
              <button
                key={animal.id}
                onClick={() => setSelectedAnimal(animal)}
                className={`w-full p-4 rounded-2xl text-left transition-all ${selectedAnimal?.id === animal.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                  : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100'
                  }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-black">{animal.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${animal.severity === 'Critical' ? 'bg-red-500 text-white' : 'bg-orange-100 text-orange-600'
                    }`}>
                    {animal.severity}
                  </span>
                </div>
                <p className="font-bold text-sm">{animal.name}</p>
                <p className={`text-[10px] mt-1 ${selectedAnimal?.id === animal.id ? 'text-white/70' : 'text-gray-500'}`}>
                  {animal.type} • {animal.anomalyDate}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel: Chart & Form */}
        <div className="flex-1 bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-gray-800 flex flex-col shadow-xl overflow-hidden">
          {selectedAnimal ? (
            <>
              <div className="h-2/3 p-8 border-b border-gray-100 dark:border-gray-800 relative">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-2">
                    <BrainCircuit className="text-primary" /> Visual Diagnostics (48h Window)
                  </h3>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                    Click chart to set symptom onset
                  </div>
                </div>
                <div className="h-[calc(100%-4rem)]">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 p-8 grid grid-cols-2 gap-8 overflow-y-auto">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Diagnostic Outcome</label>
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-bold"
                    >
                      {OUTCOME_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">Confirmed by Veterinarian</p>
                      <p className="text-[10px] text-gray-500">Official medical record validation</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isConfirmed}
                      onChange={(e) => setIsConfirmed(e.target.checked)}
                      className="w-5 h-5 accent-primary"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Observations / Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-bold h-24 custom-scrollbar"
                      placeholder="Add clinical observations..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSubmitting
                      ? <><Loader2 size={18} className="animate-spin" /> Envoi en cours...</>
                      : <><CheckCircle2 size={18} /> Submit Diagnostic</>
                    }
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-20 gap-4">
              <History className="w-16 h-16 text-gray-200" />
              <p className="text-lg font-bold text-gray-400">Selectionnez un animal pour commencer le labelling</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LabellingPage;
