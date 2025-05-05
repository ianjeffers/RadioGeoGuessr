// pages/api/guess.ts
import { NextApiRequest, NextApiResponse } from 'next';
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { round_id, guess } = req.body;
  const mockResult = {
    round_id,
    distance_km: parseFloat((Math.random() * 200).toFixed(2)),
    score: Math.floor(Math.random() * 5000),
    actual_location: JSON.parse(round_id),
    reveals: { timestamp: '14:03 local time', tags: ['news', 'local'] },
  };
  res.status(200).json(mockResult);
}