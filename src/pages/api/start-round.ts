// pages/api/start-round.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchStations, pickRandomStation, getStationsInRadius, Station } from '../../lib/stationStore';

type Clip = { clip_id: string; station: string };

debugger;
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await fetchStations();

    let chosenCenter: { lat: number; lon: number };
    let nearby: Station[] = [];
    let attempts = 0;

    // Try up to 5 times to find region with >=3 stations
    while (attempts < 10) {
      attempts += 1;
      const random = pickRandomStation();
      if (!random || typeof random.lat !== 'number' || typeof random.lon !== 'number') continue;

      chosenCenter = { lat: random.lat, lon: random.lon };
      nearby = getStationsInRadius(chosenCenter, 100);
      console.log(`Attempt ${attempts}: Found ${nearby.length} stations near [${chosenCenter.lat}, ${chosenCenter.lon}]`);

      if (nearby.length >= 3) break;
    }

    if (nearby.length < 3) {
      return res.status(503).json({ error: 'Unable to find region with enough stations, please try again.' });
    }

    // Mock clip metadata for MVP; real implementation will fetch audio
    const clips: Clip[] = nearby.slice(0, 3).map(s => ({ clip_id: s.id, station: s.name }));
    res.status(200).json({ round_id: JSON.stringify(chosenCenter), clips });
  } catch (err: any) {
    console.error('start-round error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
