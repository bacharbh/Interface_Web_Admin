import { useMemo } from 'react';
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
import { format } from 'date-fns';
import { Thermometer } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface HistoryPoint {
  animalId?: string | number;
  collar_id?: string;
  sheepId?: string;
  timestamp?: string;
  rx_time?: string;
  temp?: number;
  temperature?: number;
  sensors?: { temperature?: number; movement_g?: number };
  metadata?: { temperature?: number };
  [key: string]: any;
}

interface TemperatureChartProps {
  data: HistoryPoint[];
  theme?: string;
}

const COLORS = [
  'rgba(16, 185, 129, 1)',
  'rgba(59, 130, 246, 1)',
  'rgba(245, 158, 11, 1)',
  'rgba(239, 68, 68, 1)',
  'rgba(139, 92, 246, 1)',
  'rgba(236, 72, 153, 1)',
  'rgba(20, 184, 166, 1)',
  'rgba(249, 115, 22, 1)',
  'rgba(99, 102, 241, 1)',
  'rgba(107, 114, 128, 1)',
];

const getTemp = (p: HistoryPoint): number | null => {
  const t = p.sensors?.temperature ?? p.metadata?.temperature ?? p.temperature ?? p.temp;
  return typeof t === 'number' && !isNaN(t) ? t : null;
};

const getId = (p: HistoryPoint): string =>
  String(p.collar_id || p.sheepId || p.animalId || 'unknown');

const getTs = (p: HistoryPoint): string =>
  p.timestamp || p.rx_time || '';

const TemperatureChart = ({ data, theme }: TemperatureChartProps) => {
  const isDark = theme === 'dark';

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return { labels: [], datasets: [] };

    const groups: Record<string, HistoryPoint[]> = {};
    data.forEach(d => {
      if (getTemp(d) === null) return;
      const id = getId(d);
      if (!groups[id]) groups[id] = [];
      groups[id].push(d);
    });

    if (Object.keys(groups).length === 0) return { labels: [], datasets: [] };

    const animalIds = Object.keys(groups)
      .sort((a, b) => groups[b].length - groups[a].length)
      .slice(0, 10);

    const allLabels = [...new Set(
      data
        .filter(d => getTs(d))
        .map(d => format(new Date(getTs(d)), 'dd/MM HH:mm'))
    )].sort();

    const datasets = animalIds.map((id, index) => {
      const points = groups[id].sort((a, b) => new Date(getTs(a)).getTime() - new Date(getTs(b)).getTime());
      const seriesData = allLabels.map(label => {
        const match = points.find(p => format(new Date(getTs(p)), 'dd/MM HH:mm') === label);
        return match ? getTemp(match) : null;
      });
      return {
        label: `Collier ${id}`,
        data: seriesData,
        borderColor: COLORS[index % COLORS.length],
        backgroundColor: COLORS[index % COLORS.length].replace('1)', '0.05)'),
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.4,
        spanGaps: true,
        fill: false,
      };
    });

    return { labels: allLabels, datasets };
  }, [data]);

  const hasData = chartData.datasets.length > 0;

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          boxWidth: 6,
          boxHeight: 6,
          padding: 20,
          font: { size: 11, family: "'Inter', sans-serif", weight: 'bold' as const },
          color: isDark ? '#94a3b8' : '#64748b'
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        titleColor: isDark ? '#ffffff' : '#0f172a',
        bodyColor: isDark ? '#94a3b8' : '#64748b',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        titleFont: { weight: 'bold' },
        usePointStyle: true,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}°C` },
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8, color: isDark ? '#475569' : '#94a3b8', font: { size: 10 } }
      },
      y: {
        min: 37,
        max: 42,
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        ticks: {
          stepSize: 1,
          color: isDark ? '#475569' : '#94a3b8',
          font: { size: 10 },
          callback: (value) => `${value}°C`
        }
      }
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false }
  };

  if (!hasData) {
    return (
      <div className="h-[300px] w-full flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
        <Thermometer className="w-10 h-10 text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">Aucune donnée de température</p>
        <p className="text-xs text-slate-400 dark:text-slate-600">Les données seront affichées lorsque l'historique sera disponible.</p>
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full animate-fade-in">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default TemperatureChart;
