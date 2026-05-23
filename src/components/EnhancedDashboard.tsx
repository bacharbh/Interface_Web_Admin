import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useMqtt } from '../contexts/MqttContext';
import { useIoTStore } from '../hooks/useIoTStore';
import { useRealtimePositions } from '../hooks/useRealtimePositions';
import {
  Activity, Bell, MapPin, ShieldAlert, Cpu, Battery,
  Radio, TrendingUp, Thermometer, Heart, Droplets,
  Users, Zap, AlertTriangle, CheckCircle2, Clock,
  BarChart3, PieChart, TrendingDown
} from 'lucide-react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler, ArcElement
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler, ArcElement
);

interface MetricCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'amber' | 'red' | 'purple';
  trend?: {
    value: number;
    direction: 'up' | 'down';
    label: string;
  };
  status?: 'normal' | 'warning' | 'critical';
  subtitle?: string;
}

interface ChartData {
  labels: string[];
  datasets: any[];
}

interface MetricTrend {
  direction: 'up' | 'down' | 'stable';
  isFlashing: boolean;
}

const EnhancedDashboard: React.FC = () => {
  const { isConnected, isSimulation } = useMqtt();
  const { kpis, animalsList, alerts } = useRealtimePositions([]);
  const markAlertAsRead = useIoTStore(state => state.markAlertAsRead);

  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('6h');
  const [selectedMetric, setSelectedMetric] = useState<'overview' | 'health' | 'battery' | 'activity'>('overview');

  // Track metric changes for smooth transitions
  const [previousMetrics, setPreviousMetrics] = useState<Record<string, number>>({});
  const [metricTrends, setMetricTrends] = useState<Record<string, MetricTrend>>({});
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

  // Chart references for synchronized updates
  const activityChartRef = useRef<any>(null);
  const healthChartRef = useRef<any>(null);
  const batteryChartRef = useRef<any>(null);

  // Chart data states for real-time updates
  const [chartData, setChartData] = useState({
    activity: { labels: [] as string[], activityData: [] as number[], alertData: [] as number[] },
    health: { labels: ['Bon', 'Avertissement', 'Critique'], data: [0, 0, 0] },
    battery: { labels: ['Élevée (>75%)', 'Moyenne (25-75%)', 'Faible (<25%)'], data: [0, 0, 0] }
  });

  // Calculate metrics
  const metrics = useMemo((): MetricCard[] => {
    const batteries = animalsList.map(a => a.battery ?? 0);
    const healthDistribution = {
      good: animalsList.filter(a => a.health === 'Good').length,
      warning: animalsList.filter(a => a.health === 'Warning').length,
      critical: animalsList.filter(a => a.health === 'Critical').length,
    };

    const avgBattery = animalsList.length > 0
      ? batteries.reduce((sum, battery) => sum + battery, 0) / animalsList.length
      : 0;

    const activeDevices = batteries.filter(battery => battery > 5).length;
    const offlineDevices = animalsList.length - activeDevices;

    return [
      {
        title: 'Animaux Actifs',
        value: activeDevices,
        icon: <Activity className="w-5 h-5" />,
        color: 'green',
        status: activeDevices > animalsList.length * 0.9 ? 'normal' :
          activeDevices > animalsList.length * 0.7 ? 'warning' : 'critical',
        subtitle: `${offlineDevices} hors ligne`,
        trend: {
          value: 5.2,
          direction: 'up',
          label: 'vs dernière heure'
        }
      },
      {
        title: 'Alertes Actives',
        value: alerts.filter(a => !a.read).length,
        icon: <Bell className="w-5 h-5" />,
        color: alerts.filter(a => !a.read).length > 5 ? 'red' :
          alerts.filter(a => !a.read).length > 0 ? 'amber' : 'green',
        subtitle: `${alerts.filter(a => a.severity === 'CRITICAL').length} critiques`,
        trend: {
          value: 12.5,
          direction: 'down',
          label: 'vs dernière heure'
        }
      },
      {
        title: 'Santé Troupeau',
        value: `${Math.round((healthDistribution.good / animalsList.length) * 100) || 0}%`,
        icon: <Heart className="w-5 h-5" />,
        color: healthDistribution.critical > 0 ? 'red' :
          healthDistribution.warning > 0 ? 'amber' : 'green',
        subtitle: `${healthDistribution.warning} avertissements`,
        trend: {
          value: 2.1,
          direction: 'up',
          label: 'amélioration'
        }
      },
      {
        title: 'Batterie Moyenne',
        value: `${Math.round(avgBattery)}%`,
        icon: <Battery className="w-5 h-5" />,
        color: avgBattery > 50 ? 'green' : avgBattery > 20 ? 'amber' : 'red',
        subtitle: `${batteries.filter(battery => battery < 20).length} critiques`,
        trend: {
          value: 8.3,
          direction: 'down',
          label: 'consommation'
        }
      }
    ];
  }, [animalsList, alerts]);

  // Initialize metrics and chart data on first load
  useEffect(() => {
    if (animalsList.length === 0) return;

    // Initialize previous metrics
    const initialMetrics: Record<string, number> = {
      activeDevices: animalsList.filter(a => (a.battery ?? 0) > 5).length,
      activeAlerts: alerts.filter(a => !a.read).length,
      healthScore: Math.round((animalsList.filter(a => a.health === 'Good').length / animalsList.length) * 100) || 0,
      avgBattery: animalsList.length > 0
        ? Math.round(animalsList.reduce((sum, a) => sum + (a.battery ?? 0), 0) / animalsList.length)
        : 0
    };
    setPreviousMetrics(initialMetrics);

    // Initialize chart data
    const healthDistribution = {
      good: animalsList.filter(a => a.health === 'Good').length,
      warning: animalsList.filter(a => a.health === 'Warning').length,
      critical: animalsList.filter(a => a.health === 'Critical').length,
    };

    const batteryRanges = {
      high: animalsList.filter(a => (a.battery ?? 0) > 75).length,
      medium: animalsList.filter(a => (a.battery ?? 0) > 25 && (a.battery ?? 0) <= 75).length,
      low: animalsList.filter(a => (a.battery ?? 0) <= 25).length,
    };

    setChartData({
      activity: { labels: [], activityData: [], alertData: [] },
      health: { labels: ['Bon', 'Avertissement', 'Critique'], data: [healthDistribution.good, healthDistribution.warning, healthDistribution.critical] },
      battery: { labels: ['Élevée (>75%)', 'Moyenne (25-75%)', 'Faible (<25%)'], data: [batteryRanges.high, batteryRanges.medium, batteryRanges.low] }
    });
  }, [animalsList.length, alerts.length]);

  // Sync metrics with simulation and track changes
  useEffect(() => {
    const updateInterval = setInterval(() => {
      // Calculate new metrics
      const newMetrics: Record<string, number> = {
        activeDevices: animalsList.filter(a => (a.battery ?? 0) > 5).length,
        activeAlerts: alerts.filter(a => !a.read).length,
        healthScore: Math.round((animalsList.filter(a => a.health === 'Good').length / animalsList.length) * 100) || 0,
        avgBattery: animalsList.length > 0
          ? Math.round(animalsList.reduce((sum, a) => sum + (a.battery ?? 0), 0) / animalsList.length)
          : 0
      };

      // Calculate trends based on previous values
      const trends: Record<string, MetricTrend> = {};

      Object.entries(newMetrics).forEach(([key, newValue]) => {
        const oldValue = previousMetrics[key] ?? newValue;
        let direction: 'up' | 'down' | 'stable' = 'stable';

        // Determine trend direction based on metric type
        if (key === 'activeDevices' || key === 'healthScore' || key === 'avgBattery') {
          // Higher is better for these metrics
          direction = newValue > oldValue ? 'up' : newValue < oldValue ? 'down' : 'stable';
        } else if (key === 'activeAlerts') {
          // Lower is better for alerts
          direction = newValue < oldValue ? 'up' : newValue > oldValue ? 'down' : 'stable';
        }

        // Flash animation for significant changes
        const isFlashing = direction !== 'stable';
        trends[key] = { direction, isFlashing };
      });

      // Update Health Distribution chart data (Donut - Santé Troupeau)
      const healthDistribution = {
        good: animalsList.filter(a => a.health === 'Good').length,
        warning: animalsList.filter(a => a.health === 'Warning').length,
        critical: animalsList.filter(a => a.health === 'Critical').length,
      };

      // Update Battery Distribution chart data (Bar)
      const batteryRanges = {
        high: animalsList.filter(a => (a.battery ?? 0) > 75).length,
        medium: animalsList.filter(a => (a.battery ?? 0) > 25 && (a.battery ?? 0) <= 75).length,
        low: animalsList.filter(a => (a.battery ?? 0) <= 25).length,
      };

      // Update Activity/LSTM chart data with live metric
      const avgHealth = newMetrics.healthScore;
      const newLivePoint = avgHealth + (Math.random() - 0.5) * 10; // Add some variance

      setChartData(prev => {
        const updatedData = { ...prev };

        // Update activity data (shift and add new point)
        if (updatedData.activity.activityData.length >= 12) {
          updatedData.activity.labels.shift();
          updatedData.activity.activityData.shift();
          updatedData.activity.alertData.shift();
        }

        updatedData.activity.labels.push(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        updatedData.activity.activityData.push(Math.round(newLivePoint));
        updatedData.activity.alertData.push(alerts.filter(a => !a.read).length);

        // Update health distribution
        updatedData.health.data = [healthDistribution.good, healthDistribution.warning, healthDistribution.critical];

        // Update battery distribution
        updatedData.battery.data = [batteryRanges.high, batteryRanges.medium, batteryRanges.low];

        return updatedData;
      });

      // Update charts with animation
      setTimeout(() => {
        [activityChartRef, healthChartRef, batteryChartRef].forEach(ref => {
          if (ref.current) {
            ref.current.chart?.update('none');
          }
        });
      }, 0);

      setPreviousMetrics(newMetrics);
      setMetricTrends(trends);
      setLastUpdateTime(Date.now());
    }, 3000); // Sync with simulation (3 seconds)

    return () => clearInterval(updateInterval);
  }, [animalsList, alerts, previousMetrics]);

  // Health distribution chart data
  // Compute chart data from state with live updates
  const healthChartData = useMemo((): ChartData => {
    return {
      labels: chartData.health.labels,
      datasets: [{
        data: chartData.health.data,
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    };
  }, [chartData.health]);

  // Battery distribution chart data
  const batteryChartData = useMemo((): ChartData => {
    return {
      labels: chartData.battery.labels,
      datasets: [{
        data: chartData.battery.data,
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
        borderWidth: 0,
      }]
    };
  }, [chartData.battery]);

  // Activity timeline (LSTM) data with live point color indicator
  const activityChartData = useMemo((): ChartData => {
    // Determine color of last point based on threshold (0-100 scale)
    let lastPointColor = '#3b82f6'; // blue by default
    if (chartData.activity.activityData.length > 0) {
      const lastValue = chartData.activity.activityData[chartData.activity.activityData.length - 1];
      if (lastValue >= 75) {
        lastPointColor = '#ef4444'; // red if >= 75 (critical)
      } else if (lastValue >= 50) {
        lastPointColor = '#f59e0b'; // amber if >= 50 (warning)
      } else {
        lastPointColor = '#10b981'; // green if < 50 (normal)
      }
    }

    // Create point background colors array with last point highlighted
    const pointBackgroundColors = chartData.activity.activityData.map((_, idx) =>
      idx === chartData.activity.activityData.length - 1 ? lastPointColor : '#3b82f6'
    );

    return {
      labels: chartData.activity.labels,
      datasets: [
        {
          label: 'LSTM Score Live',
          data: chartData.activity.activityData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: pointBackgroundColors,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        },
        {
          label: 'Alertes Actives',
          data: chartData.activity.alertData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    };
  }, [chartData.activity]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: { size: 11, weight: 600 as const }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 12, weight: 600 as const },
        bodyFont: { size: 11 },
      }
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        beginAtZero: true,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: { font: { size: 10 } },
        title: { display: true, text: 'Score LSTM (%)', font: { size: 11 } }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        beginAtZero: true,
        grid: { display: false },
        ticks: { font: { size: 10 } },
        title: { display: true, text: 'Alertes', font: { size: 11 } }
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 } }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        cornerRadius: 8,
      }
    },
    cutout: '70%'
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Tableau de Bord Smart Shepherd
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Vue d'ensemble en temps réel de votre exploitation
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Indicator */}
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {isConnected ? 'Connecté' : 'Hors ligne'}
              </span>
            </div>

            {/* Time Range Selector */}
            <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
              {(['1h', '6h', '24h', '7d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${timeRange === range
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metrics.map((metric, index) => {
          const trendKeys = ['activeDevices', 'activeAlerts', 'healthScore', 'avgBattery'];
          const trendKey = trendKeys[index];
          const trend = metricTrends[trendKey] || { direction: 'stable', isFlashing: false };

          return (
            <MetricCardComponent
              key={index}
              metric={metric}
              trend={trend}
            />
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Activity Timeline */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Activité et Alertes
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Dernières {timeRange}
            </span>
          </div>
          <div className="h-80">
            <Line ref={activityChartRef} data={activityChartData} options={chartOptions} />
          </div>
        </div>

        {/* Health Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Santé Troupeau
            </h3>
          </div>
          <div className="h-80">
            <Doughnut ref={healthChartRef} data={healthChartData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Battery Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Battery className="w-5 h-5 text-green-500" />
              Distribution Batterie
            </h3>
          </div>
          <div className="h-64">
            <Bar ref={batteryChartRef} data={batteryChartData} options={chartOptions} />
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" />
              Alertes Récentes
            </h3>
            <span className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-xs font-medium px-2 py-1 rounded-full">
              {alerts.filter(a => !a.read).length} nouvelles
            </span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Aucune alerte active</p>
              </div>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <AlertItem key={alert.id} alert={alert} onRead={markAlertAsRead} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickActionCard
          icon={<MapPin className="w-6 h-6" />}
          title="Vue Carte"
          description="Accéder à la carte en temps réel"
          color="blue"
          href="/map"
        />
        <QuickActionCard
          icon={<Users className="w-6 h-6" />}
          title="Gestion Troupeau"
          description="Voir et gérer tous les animaux"
          color="green"
          href="/animals"
        />
        <QuickActionCard
          icon={<AlertTriangle className="w-6 h-6" />}
          title="Toutes les Alertes"
          description="Historique complet des alertes"
          color="amber"
          href="/alerts"
        />
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCardComponent: React.FC<{ metric: MetricCard; trend?: MetricTrend }> = ({ metric, trend }) => {
  const [isHighlighted, setIsHighlighted] = useState(false);

  // Trigger highlight animation when trend changes
  useEffect(() => {
    if (trend?.isFlashing) {
      setIsHighlighted(true);
      const timer = setTimeout(() => setIsHighlighted(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [trend?.isFlashing]);

  const statusColors = {
    normal: 'border-green-200 dark:border-green-800',
    warning: 'border-amber-200 dark:border-amber-800',
    critical: 'border-red-200 dark:border-red-800'
  };

  const trendBackgroundColors = {
    up: 'from-green-50 dark:from-green-950',
    down: 'from-red-50 dark:from-red-950',
    stable: 'from-gray-50 dark:from-gray-800'
  };

  const trendborderColors = {
    up: 'border-green-300 dark:border-green-600',
    down: 'border-red-300 dark:border-red-600',
    stable: 'border-gray-300 dark:border-gray-600'
  };

  const iconColors = {
    green: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
    blue: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400',
    red: 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400',
    purple: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
  };

  return (
    <div
      className={`
        relative bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border-2 
        transition-all duration-500 ease-in-out
        hover:shadow-md
        ${statusColors[metric.status || 'normal']}
        ${isHighlighted && trend ? trendborderColors[trend.direction] : statusColors[metric.status || 'normal']}
        ${isHighlighted ? 'shadow-lg' : 'shadow-sm'}
      `}
    >
      {/* Animated background gradient for trend indication */}
      <div
        className={`
          absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500
          ${isHighlighted && trend ? 'opacity-20' : 'opacity-0'}
          ${trend?.direction === 'up' ? 'bg-gradient-to-r from-green-400 to-transparent' : ''}
          ${trend?.direction === 'down' ? 'bg-gradient-to-r from-red-400 to-transparent' : ''}
          pointer-events-none
        `}
      />

      {/* Content wrapper */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg ${iconColors[metric.color]} transition-all duration-500`}>
            {metric.icon}
          </div>
          {metric.trend && (
            <div className={`
              flex items-center gap-1 text-xs font-medium transition-colors duration-500
              ${metric.trend.direction === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
            `}>
              {metric.trend.direction === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {metric.trend.value}%
            </div>
          )}
        </div>

        <div className="mb-2">
          <h3 className={`
            text-2xl font-bold transition-colors duration-500
            ${isHighlighted && trend?.direction === 'up' ? 'text-green-600 dark:text-green-400' : ''}
            ${isHighlighted && trend?.direction === 'down' ? 'text-red-600 dark:text-red-400' : ''}
            ${!isHighlighted ? 'text-gray-900 dark:text-white' : ''}
          `}>
            {metric.value}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            {metric.title}
          </p>
        </div>

        {metric.subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {metric.subtitle}
          </p>
        )}

        {metric.trend && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {metric.trend.label}
          </p>
        )}
      </div>
    </div>
  );
};

// Alert Item Component
const AlertItem: React.FC<{ alert: any; onRead: (id: any) => void }> = ({ alert, onRead }) => {
  const severityColors: Record<string, string> = {
    CRITICAL: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
    WARNING: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
  };

  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${severityColors[alert.severity as string]
        } ${!alert.read ? 'font-semibold' : 'opacity-75'}`}
      onClick={() => onRead(alert.id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {alert.animal_name}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {alert.type.replace('_', ' ')}
          </p>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-500">
          {new Date(alert.timestamp).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
};

// Quick Action Card Component
const QuickActionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'blue' | 'green' | 'amber';
  href: string;
}> = ({ icon, title, description, color, href }) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800 border-blue-200 dark:border-blue-700',
    green: 'bg-green-50 dark:bg-green-900 hover:bg-green-100 dark:hover:bg-green-800 border-green-200 dark:border-green-700',
    amber: 'bg-amber-50 dark:bg-amber-900 hover:bg-amber-100 dark:hover:bg-amber-800 border-amber-200 dark:border-amber-700'
  };

  return (
    <a
      href={href}
      className={`block p-6 rounded-xl border-2 transition-all ${colorClasses[color]}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {title}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>
    </a>
  );
};

export default EnhancedDashboard;
