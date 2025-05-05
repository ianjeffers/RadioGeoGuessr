// pages/api/guess.ts
import type { NextApiRequest, NextApiResponse } from 'next';

function toRad(x: number) { return (x * Math.PI) / 180; }

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function calculateScore(distance: number, maxScore = 5000, maxDistance = 20000): number {
  const frac = Math.max(0, 1 - distance / maxDistance);
  return Math.round(frac * maxScore);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { round_id, guess } = req.body as { round_id: string; guess: { lat: number; lon?: number; lng?: number } };
  console.log('API Guess - raw payload:', { round_id, guess });

  const userGuess = {
    lat: guess.lat,
    lon: typeof guess.lon === 'number' ? guess.lon : (guess.lng as number),
  };
  console.log('API Guess - normalized userGuess:', userGuess);

  let actual: { lat: number; lon: number };
  try {
    actual = JSON.parse(round_id);
    console.log('API Guess - parsed actual location:', actual);
  } catch (e) {
    console.error('Invalid round_id JSON:', round_id, e);
    res.status(400).json({ error: 'Invalid round_id' });
    return;
  }

  if (
    typeof actual.lat !== 'number' ||
    typeof actual.lon !== 'number' ||
    typeof userGuess.lat !== 'number' ||
    typeof userGuess.lon !== 'number'
  ) {
    console.error('Bad coordinates:', { actual, userGuess });
    res.status(400).json({ error: 'Invalid coordinates' });
    return;
  }

  const distance_km = haversine(actual, userGuess);
  const score = calculateScore(distance_km);
  console.log('API Guess - distance_km:', distance_km, 'score:', score);

  res.status(200).json({
    round_id,
    distance_km,
    score,
    actual_location: actual,
    reveals: { timestamp: new Date().toLocaleTimeString(), tags: [] },
  });
}