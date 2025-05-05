// lib/stationStore.ts
import fetch from 'node-fetch';

export type Station = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  url: string;
  tags: string[];
};

let stations: Station[] = [];
let stationDensityCenters: { lat: number; lon: number }[] = [];
let lastFetched = 0;
const FETCH_INTERVAL = 12 * 60 * 60 * 1000;

//duplicate code I'll probably never fix
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371; // Earth radius
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

// Fetch station list from Radio-Browser (cached every 12h)
export async function fetchStations(): Promise<void> {
  const now = Date.now();
  if (stations.length > 0 && now - lastFetched < FETCH_INTERVAL) {
    return;
  }
  const res = await fetch('https://de1.api.radio-browser.info/json/stations');
  const data = await res.json();
  console.log('Fetched station JSON:', Array.isArray(data) ? `Array of ${data.length}` : typeof data);
  if (Array.isArray(data)) {
    stations = data
      .filter((s: any) => s.url_resolved && s.geo_lat && s.geo_long)
      .map((s: any) => ({
        id: s.stationuuid,
        name: s.name,
        lat: parseFloat(s.geo_lat),
        lon: parseFloat(s.geo_long),
        url: s.url_resolved,
        tags: s.tags ? s.tags.split(',') : [],
      }));

    // Precompute station density centers (grid clusters). May need some tuning but appears functional
    const grid = new Map<string, number>();
    for (const s of stations) {
      const latBin = Math.round(s.lat);
      const lonBin = Math.round(s.lon);
      const key = `${Math.round(s.lat / 3) * 3},${Math.round(s.lon / 3) * 3}`;
      grid.set(key, (grid.get(key) || 0) + 1);
    }
    stationDensityCenters = Array.from(grid.entries())
      .filter(([_key, count]) => count >= 10)
      .map(([key]) => {
        const [lat, lon] = key.split(',').map(Number);
        return { lat, lon };
      });
    console.log(`Seeded ${stationDensityCenters.length} dense station regions`);
    console.log(`Total valid stations: ${stations.length}`);
  }
  lastFetched = now;
}

export function pickRandomStation(): Station {
  const idx = Math.floor(Math.random() * stations.length);
  return stations[idx];
}

export function pickRandomDenseCenter(): { lat: number; lon: number } {
  const idx = Math.floor(Math.random() * stationDensityCenters.length);
  return stationDensityCenters[idx];
}

export function getStationsInRadius(
  center: { lat: number; lon: number },
  radiusKm: number
): Station[] {
  return stations.filter(s => distanceKm({ lat: s.lat, lon: s.lon }, center) <= radiusKm);
}