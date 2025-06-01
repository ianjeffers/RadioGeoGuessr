// pages/index.tsx
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import type { LatLngLiteral } from 'leaflet';

const GameMap = dynamic(() => import('../components/GameMap'), { ssr: false });

// (unchanged) types from your API
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
  //
  // ——— State Definitions ———
  //
  const [clips, setClips] = useState<Clip[]>([]);
  const [roundId, setRoundId] = useState<string>('');
  const [loadingRound, setLoadingRound] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [guess, setGuess] = useState<LatLngLiteral | null>(null);
  const [result, setResult] = useState<GuessResult | null>(null);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [scores, setScores] = useState<number[]>([]);

  type PastRound = {
    roundId: string;
    roundNumber: number;
    clips: Clip[];
    result: GuessResult;
  };
  const [pastRounds, setPastRounds] = useState<PastRound[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  //
  // ——— Reset everything and go back to Start Screen ———
  //
  const goHome = () => {
    setClips([]);
    setRoundId('');
    setLoadingRound(false);
    setError(null);
    setGuess(null);
    setResult(null);
    setCurrentRound(1);
    setScores([]);
    setPastRounds([]);
    setActiveTab('current');
  };

  //
  // ——— Fetch a new round from /api/start-round ———
  //
  const fetchRound = async () => {
    setLoadingRound(true);
    setError(null);
    setResult(null);
    setGuess(null);
    setClips([]); // Clear old audio immediately

    try {
      const res = await fetch('/api/start-round', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { round_id: string; clips: Clip[] };
      setRoundId(data.round_id);
      setClips(data.clips);
    } catch (err: any) {
      setError(err.message || 'Failed to start round');
    } finally {
      setLoadingRound(false);
    }
  };

  const handleStart = () => {
    goHome();
    fetchRound();
  };

  //
  // ——— Submit a guess to /api/guess ———
  //
  const submitGuess = async () => {
    if (!guess || !roundId) return;
    setLoadingRound(true);
    setError(null);

    try {
      const res = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: roundId, guess }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GuessResult;
      setResult(data);
      setScores((prev) => [...prev, data.score]);

      // Save this finished round into pastRounds
      setPastRounds((prev) => [
        ...prev,
        {
          roundId: data.round_id,
          roundNumber: currentRound,
          clips: clips,
          result: data,
        },
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to submit guess');
    } finally {
      setLoadingRound(false);
    }
  };

  //
  // ——— Move to Next Round (if any) ———
  //
  const nextRound = () => {
    if (currentRound < TOTAL_ROUNDS) {
      setCurrentRound((prev) => prev + 1);
      fetchRound();
      setActiveTab('current');
    }
  };

  const playAgain = () => {
    goHome();
    handleStart();
  };

  //
  // ——— Helper: Spinner JSX ———
  //
  const Spinner = () => (
    <div className="spinner-container">
      <div className="spinner" />
      <style jsx>{`
        .spinner-container {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 2rem;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-top-color: #171717;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'Arial, sans-serif' }}>
      {/* ——— Header with Home button + Tabs ——— */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={goHome}
            style={{
              padding: '0.5rem 1rem',
              background: '#171717',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Home
          </button>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>RadioGuessr</h1>
        </div>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setActiveTab('current')}
            style={{
              padding: '0.5rem 1rem',
              background: activeTab === 'current' ? '#333333' : '#ffffff',
              color: activeTab === 'current' ? '#ffffff' : '#171717',
              border: '1px solid #171717',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Current Round
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '0.5rem 1rem',
              background: activeTab === 'history' ? '#333333' : '#ffffff',
              color: activeTab === 'history' ? '#ffffff' : '#171717',
              border: '1px solid #171717',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Past Rounds
          </button>
        </nav>
      </header>

      {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}

      {/* ——— Tab: Current Round / Start Screen ——— */}
      {activeTab === 'current' && (
        <>
          {/* — Start Screen (no clips loaded and not currently loading) — */}
          {clips.length === 0 && !loadingRound && !result && (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 1rem',
                background: '#f5f5f5',
                borderRadius: '8px',
              }}
            >
              <h2 style={{ marginBottom: '1rem', color: '#171717' }}>
                Welcome to RadioGuessr!
              </h2>
              <p style={{ marginBottom: '2rem', color: '#555555' }}>
                You will hear a few short radio clips each round and guess their location on the map. 
                The closer you are, the higher your score. There are {TOTAL_ROUNDS} rounds total.
              </p>
              <button
                onClick={handleStart}
                style={{
                  padding: '1rem 2rem',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  background: '#171717',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                Start Game
              </button>
            </div>
          )}

          {/* — Custom Spinner while fetching — */}
          {loadingRound && <Spinner />}

          {/* — Round In-Progress: Show Clips → Map → Submit — */}
          {clips.length > 0 && !result && !loadingRound && (
            <>
              <h2 style={{ marginBottom: '1rem' }}>
                Round {currentRound} of {TOTAL_ROUNDS}
              </h2>

              <div style={{ margin: '1rem 0' }}>
                {clips.map((clip) => (
                  <div
                    key={clip.clip_id}
                    style={{
                      border: '1px solid #cccccc',
                      borderRadius: '4px',
                      padding: '0.75rem',
                      marginBottom: '1rem',
                      background: '#ffffff',
                    }}
                  >
                    <p style={{ marginBottom: '0.5rem', color: '#171717' }}>
                      <strong>Clip ID:</strong> {clip.clip_id}
                    </p>
                    <audio controls src={clip.audio_url} style={{ width: '100%' }} />
                  </div>
                ))}
              </div>

              <div style={{ height: 400, margin: '1rem 0' }}>
                <GameMap guess={guess} actual={null} onGuess={setGuess} />
              </div>

              <button
                onClick={submitGuess}
                disabled={!guess || loadingRound}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  cursor: guess && !loadingRound ? 'pointer' : 'not-allowed',
                  background: guess && !loadingRound ? '#171717' : '#888888',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                {loadingRound ? 'Submitting…' : 'Submit Guess'}
              </button>
            </>
          )}

          {/* — Round Results (keep clips playable) — */}
          {result && (
            <div style={{ marginTop: '2rem' }}>
              {/* Re‐playable clips for this round */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.75rem', color: '#171717' }}>
                  Re‐play Round {currentRound} Clips
                </h3>
                {clips.map((clip) => (
                  <div
                    key={clip.clip_id}
                    style={{
                      border: '1px solid #dddddd',
                      borderRadius: '4px',
                      padding: '0.5rem',
                      marginBottom: '1rem',
                      background: '#fafafa',
                    }}
                  >
                    <p style={{ marginBottom: '0.5rem', color: '#171717' }}>
                      Clip: {clip.clip_id}
                    </p>
                    <audio controls src={clip.audio_url} style={{ width: '100%' }} />
                  </div>
                ))}
              </div>

              <div style={{ height: 400, marginBottom: '1rem' }}>
                <GameMap
                  guess={guess}
                  actual={result.actual_location}
                  onGuess={() => {}}
                />
              </div>

              <h2 style={{ marginBottom: '0.5rem' }}>Round {currentRound} Results</h2>
              <p style={{ marginBottom: '0.25rem', color: '#171717' }}>
                <strong>Score:</strong> {result.score}
              </p>
              <p style={{ marginBottom: '1rem', color: '#171717' }}>
                <strong>Distance:</strong>{' '}
                {typeof result.distance_km === 'number'
                  ? `${result.distance_km.toFixed(2)} km`
                  : 'N/A'}
              </p>

              {/* Improved Reveal Hints Box */}
              <div
                style={{
                  margin: '1rem 0',
                  padding: '1rem',
                  background: '#f0f0f0',
                  border: '1px solid #cccccc',
                  borderRadius: '4px',
                }}
              >
                <h3 style={{ marginBottom: '0.5rem', color: '#171717' }}>Reveal Hints</h3>
                <p style={{ margin: '0.25rem 0', color: '#333333' }}>
                  <strong>Recorded:</strong> {result.reveals.timestamp}
                </p>
                <p style={{ margin: '0.25rem 0', color: '#333333' }}>
                  <strong>Tags:</strong> {result.reveals.tags.join(', ')}
                </p>
              </div>

              {/* Next Round or Game Over */}
              {currentRound < TOTAL_ROUNDS ? (
                <button
                  onClick={nextRound}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    background: '#171717',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                  }}
                >
                  Next Round ▶
                </button>
              ) : (
                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                  <h2 style={{ marginBottom: '0.5rem', color: '#171717' }}>Game Over!</h2>
                  <p style={{ marginBottom: '1rem', color: '#171717' }}>
                    <strong>Total Score:</strong> {scores.reduce((a, b) => a + b, 0)}
                  </p>
                  <button
                    onClick={playAgain}
                    style={{
                      padding: '0.75rem 1.5rem',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      background: '#171717',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                    }}
                  >
                    Play Again
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ——— Tab: Past Rounds (History) ——— */}
      {activeTab === 'history' && (
        <div>
          {pastRounds.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: '2rem', color: '#555555' }}>
              No past rounds yet.
            </p>
          ) : (
            pastRounds.map((pr) => (
              <div
                key={pr.roundId}
                style={{
                  marginBottom: '2rem',
                  border: '1px solid #bbbbbb',
                  borderRadius: '6px',
                  padding: '1rem',
                  background: '#f7f7f7',
                }}
              >
                <h3 style={{ marginBottom: '0.5rem', color: '#171717' }}>
                  Round {pr.roundNumber}
                </h3>
                <p style={{ marginBottom: '0.5rem', color: '#171717' }}>
                  <strong>Score:</strong> {pr.result.score} |{' '}
                  <strong>Distance:</strong> {pr.result.distance_km.toFixed(2)} km
                </p>

                <div style={{ margin: '1rem 0' }}>
                  {pr.clips.map((c) => (
                    <div key={c.clip_id} style={{ marginBottom: '1rem' }}>
                      <p style={{ marginBottom: '0.25rem', color: '#171717' }}>
                        <strong>Clip:</strong> {c.clip_id}
                      </p>
                      <audio controls src={c.audio_url} style={{ width: '100%' }} />
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '0.9rem', color: '#333333' }}>
                  <p style={{ marginBottom: '0.25rem' }}>
                    <strong>Recorded:</strong> {pr.result.reveals.timestamp}
                  </p>
                  <p style={{ marginBottom: '0.25rem' }}>
                    <strong>Tags:</strong> {pr.result.reveals.tags.join(', ')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
