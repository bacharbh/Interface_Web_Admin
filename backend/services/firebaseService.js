import axios from 'axios';

const DB_URL = (process.env.FIREBASE_DATABASE_URL || 'https://smartshepherd-4413d-default-rtdb.firebaseio.com').replace(/\/$/, '');
const DB_SECRET = process.env.FIREBASE_DATABASE_SECRET || '';

function authSuffix(hasQuery = false) {
  if (!DB_SECRET) return '';
  return (hasQuery ? '&' : '?') + `auth=${DB_SECRET}`;
}

function entryTime(entry) {
  return entry?.lora?.rx_time || entry?.rx_time || null;
}

function computeHealth(sensors) {
  if (!sensors) return 'good';
  const temp = sensors.temperature;
  if (temp == null) return 'good';
  if (temp > 40 || temp < 37) return 'critical';
  if (temp > 39.5 || temp < 38.0) return 'warning';
  return 'good';
}


function latestEntry(history = {}) {
  const entries = Object.values(history);
  if (!entries.length) return {};
  return entries.sort((a, b) => new Date(entryTime(b)) - new Date(entryTime(a)))[0];
}

// Find the most recent entry that contains any of the given sensor fields
function latestEntryWithSensor(history = {}, ...fields) {
  const entries = Object.values(history);
  const matching = entries.filter(e => {
    const s = e?.sensors || {};
    return fields.some(f => s[f] != null);
  });
  if (!matching.length) return null;
  return matching.sort((a, b) => new Date(entryTime(b)) - new Date(entryTime(a)))[0];
}

function mapToAnimalWithHistory(collarId, latest = {}, history = {}) {
  const sensors = latest.sensors || {};
  // Fall back to the most recent history entry that actually has a BPM reading
  const bpmEntry = latestEntryWithSensor(history, 'bpm', 'heart_rate', 'heartRate');
  const bpmSensors = bpmEntry?.sensors || {};

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
    heartRate:
      sensors.heart_rate ?? sensors.heartRate ?? sensors.bpm ??
      bpmSensors.heart_rate ?? bpmSensors.heartRate ?? bpmSensors.bpm ?? null,
    battery: sensors.battery ?? latest.battery ?? null,
    lat: null,
    lng: null,
    location: { type: 'Point', coordinates: [0, 0] },
    lastSeen: entryTime(latest) || null,
    lastUpdate: entryTime(latest) || null,
    lora: latest.lora || null,
    imu: latest.imu || null,
    ts: latest.ts || null,
    isActive: true,
    active: true,
    updatedAt: entryTime(latest) || new Date().toISOString(),
    createdAt: entryTime(latest) || new Date().toISOString(),
  };
}

<<<<<<< HEAD
=======
function latestEntry(history = {}) {
  const entries = Object.values(history);
  if (!entries.length) return {};
  return entries.sort((a, b) => new Date(entryTime(b)) - new Date(entryTime(a)))[0];
}

>>>>>>> 06d853e5c17655b3af6f1c56ad6cf748927d17ef
export async function getAllAnimals() {
  const { data } = await axios.get(`${DB_URL}/animals.json${authSuffix()}`);
  if (!data) return [];

  return Object.entries(data).map(([collarId, animal]) =>
    mapToAnimalWithHistory(collarId, latestEntry(animal.history), animal.history || {})
  );
}

export async function getAnimalByCollarId(collarId) {
  const { data } = await axios.get(`${DB_URL}/animals/${collarId}.json${authSuffix()}`);
  if (!data) return null;
  return mapToAnimalWithHistory(collarId, latestEntry(data.history), data.history || {});
}

export async function getAnimalHistory(collarId, { limit = 100, from, to } = {}) {
  const { data } = await axios.get(`${DB_URL}/animals/${collarId}/history.json${authSuffix()}`);
  if (!data) return [];

  let entries = Object.entries(data).map(([key, val]) => ({ key, collar_id: collarId, ...val }));

  if (from || to) {
    entries = entries.filter(e => {
      const t = new Date(entryTime(e));
      if (from && t < new Date(from)) return false;
      if (to && t > new Date(to)) return false;
      return true;
    });
  }

  return entries
    .sort((a, b) => new Date(entryTime(b)) - new Date(entryTime(a)))
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
      const t = new Date(entryTime(e));
      if (from && t < new Date(from)) return false;
      if (to && t > new Date(to)) return false;
      return true;
    });
  }

  return filtered
    .sort((a, b) => new Date(entryTime(b)) - new Date(entryTime(a)))
    .slice(0, Number(limit));
}

export async function getCollarIds() {
  const { data } = await axios.get(`${DB_URL}/animals.json?shallow=true${authSuffix(true)}`);
  if (!data) return [];
  return Object.keys(data);
}

// --- Labels (Ground-Truth) in RTDB ---

export async function saveLabel(label) {
  const id = label._id || `label-${Date.now()}`;
  await axios.put(`${DB_URL}/labels/${id}.json${authSuffix()}`, label);
  return { ...label, _id: id };
}

export async function getLabels() {
  const { data } = await axios.get(`${DB_URL}/labels.json${authSuffix()}`);
  if (!data) return [];
  return Object.values(data).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getLabelsCount() {
<<<<<<< HEAD
  const { data } = await axios.get(`${DB_URL}/labels.json${authSuffix()}`);
  if (!data) return 0;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return Object.values(data).filter(
    (label) => label.createdAt && label.createdAt >= startOfMonth
  ).length;
=======
  const { data } = await axios.get(`${DB_URL}/labels.json?shallow=true${authSuffix(true)}`);
  if (!data) return 0;
  return Object.keys(data).length;
>>>>>>> 06d853e5c17655b3af6f1c56ad6cf748927d17ef
}

// --- RTDB collections: farms / memberships / users ---

async function getRtdbCollection(collection) {
  const { data } = await axios.get(`${DB_URL}/${collection}.json${authSuffix()}`);
  if (!data) return [];
  return Object.entries(data).map(([id, val]) => ({ id, ...val }));
}

export async function getFirestoreStats() {
  const [farms, memberships, users] = await Promise.all([
    getRtdbCollection('farms'),
    getRtdbCollection('memberships'),
    getRtdbCollection('users'),
  ]);
  return {
    farms:       { count: farms.length,       items: farms },
    memberships: { count: memberships.length, items: memberships },
    users:       { count: users.length,       items: users },
  };
}

// --- Users CRUD in RTDB ---

export async function getAllRtdbUsers() {
  return getRtdbCollection('users');
}

export async function getRtdbUser(id) {
  const { data } = await axios.get(`${DB_URL}/users/${id}.json${authSuffix()}`);
  return data ? { id, ...data } : null;
}

export async function saveRtdbUser(id, user) {
  await axios.put(`${DB_URL}/users/${id}.json${authSuffix()}`, user);
  return { id, ...user };
}

// --- Anomalies in RTDB ---

export async function saveAnomaly(anomaly) {
  const id = anomaly._id || `anomaly-${Date.now()}`;
  await axios.put(`${DB_URL}/anomalies/${id}.json${authSuffix()}`, anomaly);
  return { ...anomaly, _id: id };
}

export async function getAnomalies() {
  const { data } = await axios.get(`${DB_URL}/anomalies.json${authSuffix()}`);
  if (!data) return [];
  return Object.values(data)
    .sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt))
    .slice(0, 100);
}

export async function resolveAnomaly(id) {
  const { data } = await axios.get(`${DB_URL}/anomalies/${id}.json${authSuffix()}`);
  if (!data) return null;
  const updated = { ...data, resolved: true, resolvedAt: new Date().toISOString() };
  await axios.put(`${DB_URL}/anomalies/${id}.json${authSuffix()}`, updated);
  return updated;
}
