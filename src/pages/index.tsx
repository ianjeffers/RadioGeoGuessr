// pages/index.tsx
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import type { LatLngLiteral } from 'leaflet';

const GameMap = dynamic(() => import('../components/GameMap'), { ssr: false });

type Clip = { clip_id: string; audio_url: string };
type GuessResult = {
  round_id: string;
  distance_km: number;
  score: number;
  actual_location: LatLngLiteral;
  reveals: { timestamp: string; tags: string[] };
};

const TOTAL_ROUNDS = 3;

export default function Home() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [roundId, setRoundId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [guess, setGuess] = useState<LatLngLiteral | null>(null);
  const [result, setResult] = useState<GuessResult | null>(null);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [scores, setScores] = useState<number[]>([]);

  const fetchRound = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setGuess(null);
    try {
      const res = await fetch('/api/start-round', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRoundId(data.round_id);
      setClips(data.clips);
    } catch (err: any) {
      setError(err.message || 'Failed to start round');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    setCurrentRound(1);
    setScores([]);
    fetchRound();
  };

  const submitGuess = async () => {
    if (!guess || !roundId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: roundId, guess }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GuessResult = await res.json();
      setResult(data);
      setScores(prev => [...prev, data.score]);
    } catch (err: any) {
      setError(err.message || 'Failed to submit guess');
    } finally {
      setLoading(false);
    }
  };

  const nextRound = () => {
    if (currentRound < TOTAL_ROUNDS) {
      setCurrentRound(prev => prev + 1);
      fetchRound();
    }
  };

  const playAgain = () => {
    handleStart();
  };

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Radio GeoGuessr (Mock)</h1>
      {clips.length === 0 && (
        <button onClick={handleStart} style={{ padding: '0.5rem 1rem' }}>
          Start Game
        </button>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {clips.length > 0 && !result && (
        <>
          <h2>Round {currentRound} of {TOTAL_ROUNDS}</h2>
          {clips.map(clip => (
            <div key={clip.clip_id} style={{ margin: '1rem 0' }}>
              <p>Clip: {clip.clip_id}</p>
              <audio controls src={clip.audio_url} style={{ width: '100%' }} />
            </div>
          ))}
          <div style={{ height: 400, margin: '1rem 0' }}>
            <GameMap guess={guess} actual={null} onGuess={setGuess} />
          </div>
          <button onClick={submitGuess} disabled={!guess || loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Submitting...' : 'Submit Guess'}
          </button>
        </>
      )}

      {result && (
        <div style={{ marginTop: '1rem' }}>
          {/* Map showing guess vs actual on results */}
          <div style={{ height: 400, margin: '1rem 0' }}>
            <GameMap guess={guess} actual={result.actual_location} onGuess={() => {}} />
          </div>
          <h2>Round {currentRound} Results</h2>
          <p><strong>Score:</strong> {result.score}</p>
          {typeof result?.distance_km === 'number' ? (
            <p><strong>Distance:</strong> {result.distance_km.toFixed(2)} km</p>
          ) : (
            <p><strong>Distance:</strong> N/A</p>
          )}
          <div>
            <h3>Reveal Hints</h3>
            <p><strong>Recorded:</strong> {result.reveals.timestamp}</p>
            <p><strong>Tags:</strong> {result.reveals.tags.join(', ')}</p>
          </div>
          {currentRound < TOTAL_ROUNDS ? (
            <button onClick={nextRound} style={{ padding: '0.5rem 1rem', marginTop: '1rem' }}>
              Next Round
            </button>
          ) : (
            <div style={{ marginTop: '1rem' }}>
              <h2>Game Over!</h2>
              <p><strong>Total Score:</strong> {scores.reduce((a, b) => a + b, 0)}</p>
              <button onClick={playAgain} style={{ padding: '0.5rem 1rem', marginTop: '1rem' }}>
                Play Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
