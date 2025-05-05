// pages/api/start-round.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const mockData = {
    round_id: 'mock-round-123',
    clips: [
      { clip_id: 'clip1', audio_url: '/mock/clip1.mp3' },
      { clip_id: 'clip2', audio_url: '/mock/clip2.mp3' },
      { clip_id: 'clip3', audio_url: '/mock/clip3.mp3' },
    ],
  };
  res.status(200).json(mockData);
}