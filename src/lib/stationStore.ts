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
const FETCH_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Haversine‐formula distance in km between two lat/lon points.
 * (We dedupe this here so we can compute “stations within radius.”)
 */
function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c = sinDLat * sinDLat +
            sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

/**
 * Fetch the full list of radio stations (cached in‐memory for 12 hours).
 * If both de2 and de1 endpoints fail, we leave the old data intact.
 */
export async function fetchStations(): Promise<void> {
  const now = Date.now();

  // If we've already fetched within the last 12 hours, just return early.
  if (stations.length > 0 && now - lastFetched < FETCH_INTERVAL) {
    return;
  }

  let data: any;
  let didFetchSucceed = false;

  // Attempt primary endpoint (de2)
  try {
    const res = await fetch('https://de2.api.radio-browser.info/json/stations');
    if (!res.ok) {
      throw new Error(`de2 responded ${res.status}`);
    }
    data = await res.json();
    didFetchSucceed = true;
  } catch (err) {
    console.error('Primary fetch (de2) failed:', err);
  }

  // If primary failed, attempt fallback (de1)
  if (!didFetchSucceed) {
    try {
      const fallback = await fetch('https://de1.api.radio-browser.info/json/stations');
      if (!fallback.ok) {
        throw new Error(`de1 responded ${fallback.status}`);
      }
      data = await fallback.json();
      didFetchSucceed = true;
      console.log('Fetched from fallback (de1).');
    } catch (err) {
      console.error('Fallback fetch (de1) also failed:', err);
    }
  }

  // If we still have no valid array, bail out and do not reset lastFetched.
  if (!didFetchSucceed || !Array.isArray(data)) {
    console.warn('Could not retrieve station list; keeping existing cache.');
    return;
  }

  // Process and filter the raw JSON into our typed Station[]
  const rawStations = (data as any[]).filter(s => {
    return (
      typeof s.stationuuid === 'string' &&
      typeof s.name === 'string' &&
      s.geo_lat != null &&
      s.geo_long != null &&
      typeof s.url_resolved === 'string'
    );
  });

  stations = rawStations.map(s => ({
    id: s.stationuuid,
    name: s.name,
    lat: parseFloat(s.geo_lat),
    lon: parseFloat(s.geo_long),
    url: s.url_resolved,
    tags: s.tags ? (s.tags as string).split(',') : [],
  }));

  // Precompute “dense” grid centers (each grid cell is ~3°×3°; adjust if needed)
  const grid = new Map<string, number>();
  for (const st of stations) {
    // Round lat/lon to nearest multiple of 3
    const key = `${Math.round(st.lat / 3) * 3},${Math.round(st.lon / 3) * 3}`;
    grid.set(key, (grid.get(key) || 0) + 1);
  }
  stationDensityCenters = Array.from(grid.entries())
    .filter(([_, count]) => count >= 10) // “dense” = at least 10 stations in that 3°×3° cell
    .map(([key, _]) => {
      const [lat, lon] = key.split(',').map(Number);
      return { lat, lon };
    });

  console.log(`Seeded ${stationDensityCenters.length} dense station regions`);
  console.log(`Total valid stations: ${stations.length}`);

  // Finally, update our lastFetched timestamp only once everything succeeded
  lastFetched = now;
}

/**
 * Pick one random station from the cached array.
 * If fetchStations() was never called (or failed), this may return undefined!
 */
export function pickRandomStation(): Station {
  if (stations.length === 0) {
    throw new Error('No stations available; make sure fetchStations() succeeded.');
  }
  const idx = Math.floor(Math.random() * stations.length);
  return stations[idx];
}

/**
 * Pick one random “dense” center (a lat/lon of a 3°×3° cell that had ≥10 stations).
 */
export function pickRandomDenseCenter(): { lat: number; lon: number } {
  if (stationDensityCenters.length === 0) {
    throw new Error('No density centers available; ensure stations were fetched and processed.');
  }
  const idx = Math.floor(Math.random() * stationDensityCenters.length);
  return stationDensityCenters[idx];
}

/**
 * Return all stations within radiusKm of a given center.
 * Deduplicates by station.id (in case two grid cells overlap).
 */
export function getStationsInRadius(
  center: { lat: number; lon: number },
  radiusKm: number
): Station[] {
  const seen = new Set<string>();
  return stations
    .filter(s => distanceKm({ lat: s.lat, lon: s.lon }, center) <= radiusKm)
    .filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
}
