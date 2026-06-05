import axios from 'axios';

const DB_URL = (process.env.FIREBASE_DATABASE_URL || 'https://smartshepherd-4413d-default-rtdb.firebaseio.com').replace(/\/$/, '');
const DB_SECRET = process.env.FIREBASE_DATABASE_SECRET || '';

function authSuffix(hasQuery = false) {
  if (!DB_SECRET) return '';
  return (hasQuery ? '&' : '?') + `auth=${DB_SECRET}`;
}

function computeHealth(sensors) {
  if (!sensors) return 'good';
  const temp = sensors.temperature;
  if (temp == null) return 'good';
  if (temp > 40 || temp < 37) return 'critical';
  if (temp > 39.5 || temp < 38.0) return 'warning';
  return 'good';
}

function mapToAnimal(collarId, latest = {}) {
  const sensors = latest.sensors || {};
  const health = computeHealth(sensors);

  return {
    _id: collarId,
    sheepId: collarId,
    collar_id: collarId,
    collarId: collarId,
    name: collarId,
    breed: 'Other',
    gender: 'unknown',
    age: 0,
    weight: 0,
    healthStatus: health === 'good' ? 'healthy' : health === 'warning' ? 'under_observation' : 'sick',
    health,
    status: health,
    temperature: sensors.temperature ?? null,
    movement_g: sensors.movement_g ?? null,
    battery: 85,
    lat: null,
    lng: null,
    location: { type: 'Point', coordinates: [0, 0] },
    lastSeen: latest.rx_time || null,
    lastUpdate: latest.rx_time || null,
    lora: latest.lora || null,
    imu: latest.imu || null,
    ts: latest.ts || null,
    isActive: true,
    active: true,
    updatedAt: latest.rx_time || new Date().toISOString(),
    createdAt: latest.rx_time || new Date().toISOString(),
  };
}

function latestEntry(history = {}) {
  const entries = Object.values(history);
  if (!entries.length) return {};
  return entries.sort((a, b) => new Date(b.rx_time) - new Date(a.rx_time))[0];
}

export async function getAllAnimals() {
  const { data } = await axios.get(`${DB_URL}/animals.json${authSuffix()}`);
  if (!data) return [];

  return Object.entries(data).map(([collarId, animal]) =>
    mapToAnimal(collarId, latestEntry(animal.history))
  );
}

export async function getAnimalByCollarId(collarId) {
  const { data } = await axios.get(`${DB_URL}/animals/${collarId}.json${authSuffix()}`);
  if (!data) return null;
  return mapToAnimal(collarId, latestEntry(data.history));
}

export async function getAnimalHistory(collarId, { limit = 100, from, to } = {}) {
  const { data } = await axios.get(`${DB_URL}/animals/${collarId}/history.json${authSuffix()}`);
  if (!data) return [];

  let entries = Object.entries(data).map(([key, val]) => ({ key, collar_id: collarId, ...val }));

  if (from || to) {
    entries = entries.filter(e => {
      const t = new Date(e.rx_time);
      if (from && t < new Date(from)) return false;
      if (to && t > new Date(to)) return false;
      return true;
    });
  }

  return entries
    .sort((a, b) => new Date(b.rx_time) - new Date(a.rx_time))
    .slice(0, Number(limit));
}

export async function getAllHistory({ limit = 200, collarId, from, to } = {}) {
  if (collarId) return getAnimalHistory(collarId, { limit, from, to });

  const { data } = await axios.get(`${DB_URL}/animals.json${authSuffix()}`);
  if (!data) return [];

  const all = [];
  for (const [cid, animal] of Object.entries(data)) {
    const history = animal.history || {};
    for (const [key, entry] of Object.entries(history)) {
      all.push({ key, collar_id: cid, sheepId: cid, deviceId: cid, ...entry });
    }
  }

  let filtered = all;
  if (from || to) {
    filtered = all.filter(e => {
      const t = new Date(e.rx_time);
      if (from && t < new Date(from)) return false;
      if (to && t > new Date(to)) return false;
      return true;
    });
  }

  return filtered
    .sort((a, b) => new Date(b.rx_time) - new Date(a.rx_time))
    .slice(0, Number(limit));
}

export async function getCollarIds() {
  const { data } = await axios.get(`${DB_URL}/animals.json?shallow=true${authSuffix(true)}`);
  if (!data) return [];
  return Object.keys(data);
}
