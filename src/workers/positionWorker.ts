/**
 * Web Worker for Smart Shepherd.
 * Offloads heavy spatial calculations from the main UI thread.
 */

interface IPosition {
  lat: number;
  lng: number;
}

const isPointInPolygon = (point: IPosition, polygon: number[][]): boolean => {
  const x = point.lat;
  const y = point.lng;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Clustering constants
const GRID_SIZE = 80; // Pixels at current zoom

const getGridCell = (lat: number, lng: number, zoom: number) => {
  const scale = Math.pow(2, zoom);
  const x = (lng + 180) / 360 * scale;
  const y = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * scale;
  return {
    gx: Math.floor(x * 256 / GRID_SIZE),
    gy: Math.floor(y * 256 / GRID_SIZE),
  };
};

self.onmessage = (e: MessageEvent) => {
  const { data } = e;
  if (!data || !data.animals) return;

  const { animals, zones, zoom } = data;
  const animalsList = Object.values(animals);
  const clusters: any = {};
  const alerts: any[] = [];

  const stats = {
    totalActive: animalsList.length,
    safe: 0,
    outOfZone: 0,
    lowBattery: 0,
    critical: 0,
    avgBattery: 0,
    unreadAlerts: 0,
    criticalAlerts: 0,
  };

  let totalBattery = 0;

  // 1. Process each animal
  const processedAnimals = animalsList.map((animal: any) => {
    const battery = animal.battery ?? 0;
    const lat = typeof animal.lat === 'number' ? animal.lat : 0;
    const lng = typeof animal.lng === 'number' ? animal.lng : 0;
    // Geofencing check
    let insideAny = zones.length === 0;
    zones.forEach((zone: any) => {
      if (isPointInPolygon(animal, zone.coords)) {
        insideAny = true;
      }
    });

    const isOutOfZone = !insideAny;
    const batteryLow = battery < 20;
    const isCritical = animal.health === 'Critical' || battery < 10;

    let status = 'SAFE';
    if (isCritical) status = 'CRITICAL';
    else if (isOutOfZone) status = 'OUT_OF_ZONE';
    else if (batteryLow) status = 'LOW_BATTERY';

    // Stats update
    if (status === 'SAFE') stats.safe++;
    if (status === 'OUT_OF_ZONE') stats.outOfZone++;
    if (status === 'LOW_BATTERY') stats.lowBattery++;
    if (status === 'CRITICAL') stats.critical++;
    totalBattery += battery;

    const enriched = {
      ...animal,
      status,
      isOutOfZone,
      batteryLow,
      isCritical
    };

    // 2. Add to clustering grid
    const { gx, gy } = getGridCell(lat, lng, zoom);
    const cellId = `${gx}_${gy}`;

    if (!clusters[cellId]) {
      clusters[cellId] = {
        id: cellId,
        centerLat: 0,
        centerLng: 0,
        count: 0,
        status: status,
        animalIds: [],
        animals: [],
      };
    }

    const c = clusters[cellId];
    c.centerLat += lat;
    c.centerLng += lng;
    c.count++;
    c.animalIds.push(animal.collar_id);
    c.animals.push(enriched);

    // Cluster status priority: CRITICAL > OUT_OF_ZONE > LOW_BATTERY > SAFE
    const priority: { [key: string]: number } = { CRITICAL: 4, OUT_OF_ZONE: 3, LOW_BATTERY: 2, SAFE: 1 };
    if (priority[status] > priority[c.status]) {
      c.status = status;
    }

    return enriched;
  });

  // Finalize stats
  stats.avgBattery = stats.totalActive > 0 ? Math.round(totalBattery / stats.totalActive) : 0;

  // 3. Finalize clusters
  const finalClusters = Object.values(clusters).map((c: any) => ({
    id: c.id,
    center: [c.centerLat / c.count, c.centerLng / c.count],
    count: c.count,
    status: c.status,
    animalIds: c.animalIds,
    animals: c.animals, // Optional: only if we need it for sidebar
  }));

  // Return results
  self.postMessage({
    animalsList: processedAnimals,
    clusters: finalClusters,
    stats,
  });
};
