import { format } from 'date-fns';

interface HistoryPoint {
  animalId: string | number;
  timestamp: string;
  battery: number;
  lat: number;
  lng: number;
  temp?: number;
  [key: string]: any;
}

/**
 * Predicts the days until 0% battery using Simple Linear Regression.
 * Using data from last 72 hours for better accuracy.
 * @param {HistoryPoint[]} history - Array of { timestamp, battery }
 */
export const predictBatteryDepletion = (history: HistoryPoint[]): number | null => {
  if (!history || history.length < 5) return null;

  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  const recentData = history
    .filter(h => new Date(h.timestamp).getTime() > cutoff)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (recentData.length < 5) return null;

  const n = recentData.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  const firstTime = new Date(recentData[0].timestamp).getTime();

  recentData.forEach(p => {
    // Standardize time to prevent massive numbers in calculation
    const x = (new Date(p.timestamp).getTime() - firstTime) / (1000 * 60 * 60); // hours since start
    const y = p.battery;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const denominator = (n * sumXX - sumX * sumX);
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  if (slope >= 0) return -1; // Charging or solar-gain

  const hoursUntilDeath = -intercept / slope;
  const currentHours = (Date.now() - firstTime) / (1000 * 60 * 60);
  const remainingHours = hoursUntilDeath - currentHours;

  const days = remainingHours / 24;
  return Math.max(0, parseFloat(days.toFixed(1)));
};

interface AnalyticsKPIs {
  avgBattery: number;
  mostActiveId: string | number;
  totalPoints: number;
  avgTemp: number;
}

/**
 * Aggregates herd analytics
 */
export const calculateAnalyticsKPIs = (data: HistoryPoint[]): AnalyticsKPIs => {
  if (!data || data.length === 0) return {
    avgBattery: 0,
    mostActiveId: 'N/A',
    totalPoints: 0,
    avgTemp: 0
  };

  const avgBattery = data.reduce((acc, curr) => acc + (curr.battery ?? 0), 0) / data.length;
  const avgTemp = data.reduce((acc, curr) => acc + (curr.temp ?? 0), 0) / data.length;

  const activityMap: Record<string, number> = {};
  data.forEach(d => {
    const id = String(d.animalId);
    activityMap[id] = (activityMap[id] || 0) + 1;
  });

  let mostActiveId: string | number = 'N/A';
  let maxPoints = -1;

  Object.entries(activityMap).forEach(([id, points]) => {
    if (points > maxPoints) {
      maxPoints = points;
      mostActiveId = id;
    }
  });

  return {
    avgBattery: Math.round(avgBattery),
    avgTemp: Math.round(avgTemp * 10) / 10,
    mostActiveId,
    totalPoints: data.length
  };
};

/**
 * Exports data to CSV
 */
export const downloadCSVReport = (data: HistoryPoint[]): void => {
  if (!data || data.length === 0) return;

  const headers = ['AnimalID', 'Lat', 'Lng', 'Timestamp', 'Battery', 'Temperature'];
  const csvRows = [headers.join(',')];

  data.forEach(d => {
    const row = [
      d.animalId,
      d.lat,
      d.lng,
      `"${format(new Date(d.timestamp), 'yyyy-MM-dd HH:mm:ss')}"`,
      d.battery ?? 0,
      d.temp ?? 0
    ];
    csvRows.push(row.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', `smart_shepherd_analytics_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
