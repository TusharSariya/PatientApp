import { Accelerometer } from 'expo-sensors';

const SAMPLE_INTERVAL_MS = 33; // ~30 Hz
const RECORD_DURATION_MS = 2000;

export async function recordGesture(onProgress) {
  console.log('[recordGesture] starting, Accelerometer=', typeof Accelerometer);
  const samples = [];
  try {
    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
    console.log('[recordGesture] setUpdateInterval ok');
  } catch (e) {
    console.warn('[recordGesture] setUpdateInterval failed', e);
  }

  const sub = Accelerometer.addListener(s => {
    samples.push({ x: s.x, y: s.y, z: s.z });
    if (samples.length === 1) console.log('[recordGesture] first sample received', s);
  });
  console.log('[recordGesture] listener attached');

  const start = Date.now();
  await new Promise(resolve => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      onProgress?.(Math.min(elapsed / RECORD_DURATION_MS, 1));
      if (elapsed >= RECORD_DURATION_MS) {
        clearInterval(tick);
        resolve();
      }
    }, 50);
  });

  sub.remove();
  console.log('[recordGesture] done. samples=', samples.length);
  return samples;
}

function toMagnitudes(samples) {
  return samples.map(({ x, y, z }) => Math.sqrt(x * x + y * y + z * z));
}

function dtw(a, b) {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return Infinity;
  const dp = Array.from({ length: n + 1 }, () => new Float32Array(m + 1).fill(Infinity));
  dp[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(a[i - 1] - b[j - 1]);
      dp[i][j] = cost + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[n][m] / (n + m);
}

// gestures: array of { id, word, data } where data is a JSON string or array
// returns the best matching gesture or null if no match is confident enough
export function matchGesture(recorded, gestures, threshold = 3.0) {
  if (!recorded.length || !gestures.length) return null;
  const recMag = toMagnitudes(recorded);
  let best = null;
  let bestScore = Infinity;

  for (const g of gestures) {
    const data = typeof g.data === 'string' ? JSON.parse(g.data) : g.data;
    const score = dtw(recMag, toMagnitudes(data));
    if (score < bestScore) {
      bestScore = score;
      best = g;
    }
  }

  return bestScore < threshold ? best : null;
}
