// lib/fetchClip.ts
import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import Database from 'better-sqlite3';

const LOCAL_DIR = path.join(process.cwd(), 'public', 'mock-clips');
if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

const DB_PATH = path.join(process.cwd(), 'data', 'clipcache.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS clips (
  station_id TEXT,
  bucket TEXT,
  local_path TEXT,
  last_checked INTEGER,
  PRIMARY KEY (station_id, bucket)
);`);

/**
 * Locally fetch (or reuse) a 10‑second MP3 clip for a station.
 * Saves to /public/mock-clips and caches metadata in SQLite.
 */
export async function fetchClip(stationId: string, streamUrl: string, bucket: string): Promise<string> {
  const filename = `${stationId}-${bucket}.mp3`;
  const outPath = path.join(LOCAL_DIR, filename);
  const publicUrl = `/mock-clips/${filename}`;

  const row = db.prepare('SELECT local_path FROM clips WHERE station_id = ? AND bucket = ?')
                .get(stationId, bucket);
  if (row && fs.existsSync(path.join(LOCAL_DIR, path.basename(row.local_path)))) {
    return publicUrl;
  }

  try {
    await execa(ffmpegPath, [
      '-i', streamUrl,
      '-t', '10',
      '-ac', '1',
      '-ar', '22050',
      '-y', outPath,
    ], { timeout: 20000 });

    db.prepare('INSERT OR REPLACE INTO clips (station_id, bucket, local_path, last_checked) VALUES (?, ?, ?, ?)')
      .run(stationId, bucket, outPath, Date.now());

    return publicUrl;
  } catch (err) {
    console.error('FFmpeg error for', stationId, err);
    throw new Error('Clip fetch failed');
  }
}
