// pages/api/start-round.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchStations, pickRandomStation, getStationsInRadius, Station } from '../../lib/stationStore';
import { fetchClip } from '../../lib/fetchClip';

type Clip = { clip_id: string; audio_url: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await fetchStations();

    let chosenCenter: { lat: number; lon: number };
    let nearby: Station[] = [];
    let attempts = 0;

    while (attempts < 10) {
      attempts += 1;
      const random = pickRandomStation();
      if (!random || typeof random.lat !== 'number' || typeof random.lon !== 'number') continue;
      chosenCenter = { lat: random.lat, lon: random.lon };
      nearby = getStationsInRadius(chosenCenter, 100);
      if (nearby.length >= 3) break;
    }
    if (nearby.length < 3) {
      return res.status(503).json({ error: 'Unable to find region with enough stations, please try again.' });
    }

    // Compute a time-based bucket for caching
    const bucket = Math.floor(Date.now() / (15 * 60 * 1000));

    // Fetch or retrieve cached clips for the first 3 stations
    const clips: Clip[] = await Promise.all(
      nearby.slice(0, 3).map(async (s) => {
        const audio_url = await fetchClip(s.id, s.url, bucket.toString());
        return { clip_id: s.id, audio_url };
      })
    );

    return res.status(200).json({ round_id: JSON.stringify(chosenCenter), clips });
  } catch (err: any) {
    console.error('start-round error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
