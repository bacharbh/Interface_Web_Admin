import React, { useMemo } from 'react';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface HistoryPoint {
  animalId: string | number;
  timestamp: string;
  battery: number;
  [key: string]: any;
}

interface BatteryChartProps {
  data: HistoryPoint[];
  theme?: string;
}

const BatteryChart = ({ data, theme }: BatteryChartProps) => {
  const isDark = theme === 'dark';

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return { labels: [], datasets: [] };

    // Group by animalId
    const groups: Record<string, HistoryPoint[]> = {};
    data.forEach(d => {
      const id = String(d.animalId);
      if (!groups[id]) groups[id] = [];
      groups[id].push(d);
    });

    // Take top 10 animals (by number of points)
    const animalIds = Object.keys(groups)
      .sort((a, b) => groups[b].length - groups[a].length)
      .slice(0, 10);

    // Get unique timestamps as labels (rounded to hour to align series)
    const allLabels = [...new Set(data.map(d => format(new Date(d.timestamp), 'dd/MM HH:mm')))].sort();

    const colors = [
      'rgba(16, 185, 129, 1)',   // emerald-500
      'rgba(59, 130, 246, 1)',   // blue-500
      'rgba(245, 158, 11, 1)',   // amber-500
      'rgba(239, 68, 68, 1)',    // red-500
      'rgba(139, 92, 246, 1)',   // violet-500
      'rgba(236, 72, 153, 1)',   // pink-500
      'rgba(20, 184, 166, 1)',   // teal-500
      'rgba(249, 115, 22, 1)',   // orange-500
      'rgba(99, 102, 241, 1)',   // indigo-500
      'rgba(107, 114, 128, 1)',  // gray-500
    ];

    const datasets = animalIds.map((id, index) => {
      const animalPoints = groups[id].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Map to the labels
      const seriesData = allLabels.map(label => {
        const match = animalPoints.find(p => format(new Date(p.timestamp), 'dd/MM HH:mm') === label);
        return match ? match.battery : null;
      });

      return {
        label: `Béret ${id}`,
        data: seriesData,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length].replace('1)', '0.05)'),
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.4,
        spanGaps: true,
        fill: false,
      };
    });

    return {
      labels: allLabels,
      datasets
    };
  }, [data]);

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
          font: {
            size: 11,
            family: "'Inter', sans-serif",
            weight: 'bold' as const
          },
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
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxTicksLimit: 8,
          color: isDark ? '#475569' : '#94a3b8',
          font: { size: 10 }
        }
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
        },
        ticks: {
          stepSize: 20,
          color: isDark ? '#475569' : '#94a3b8',
          font: { size: 10 },
          callback: (value) => `${value}%`
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  return (
    <div className="h-[300px] w-full animate-fade-in">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default BatteryChart;
